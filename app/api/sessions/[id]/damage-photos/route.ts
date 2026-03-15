import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic';


/**
 * POST /api/sessions/[id]/damage-photos
 *
 * Upload damage assessment photos for a parking session.
 * Accepts base64-encoded images in JSON body.
 *
 * Body:
 *   photos: Array<{ data: string (base64 data URL), label?: string }>
 *   damage_notes?: string
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params
        const body = await request.json()
        const { photos, damage_notes } = body

        if (!photos || !Array.isArray(photos) || photos.length === 0) {
            return NextResponse.json(
                { error: 'At least one photo is required' },
                { status: 400 }
            )
        }

        // Verify session exists
        const sessionCheck = await pool.query(
            'SELECT id, status FROM parking_sessions WHERE id = $1',
            [sessionId]
        )
        if (sessionCheck.rows.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'damage')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }

        const savedPhotos: Array<{
            url: string
            label: string
            timestamp: string
        }> = []

        for (let i = 0; i < photos.length; i++) {
            const photo = photos[i]
            if (!photo.data) continue

            // Extract base64 data from data URL
            const matches = photo.data.match(/^data:image\/([\w+]+);base64,(.+)$/)
            if (!matches) continue

            const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
            const buffer = Buffer.from(matches[2], 'base64')
            const filename = `${sessionId}_${Date.now()}_${i}.${ext}`
            const filepath = path.join(uploadDir, filename)

            fs.writeFileSync(filepath, buffer)

            savedPhotos.push({
                url: `/uploads/damage/${filename}`,
                label: photo.label || `Photo ${i + 1}`,
                timestamp: new Date().toISOString(),
            })
        }

        if (savedPhotos.length === 0) {
            return NextResponse.json(
                { error: 'No valid photos could be processed' },
                { status: 400 }
            )
        }

        // Get existing photos and append
        const existing = await pool.query(
            'SELECT damage_photos FROM parking_sessions WHERE id = $1',
            [sessionId]
        )
        const existingPhotos = existing.rows[0]?.damage_photos || []
        const allPhotos = [...existingPhotos, ...savedPhotos]

        // Update session with photos + notes
        await pool.query(
            `UPDATE parking_sessions 
       SET damage_photos = $1::jsonb,
           damage_notes = COALESCE($2, damage_notes)
       WHERE id = $3`,
            [JSON.stringify(allPhotos), damage_notes || null, sessionId]
        )

        return NextResponse.json(
            {
                message: `${savedPhotos.length} photo(s) uploaded successfully`,
                photos: savedPhotos,
                total_photos: allPhotos.length,
            },
            { status: 200 }
        )
    } catch (error) {
        console.error('Damage photo upload error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * GET /api/sessions/[id]/damage-photos
 *
 * Retrieve damage photos for a session.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: sessionId } = await params

        const result = await pool.query(
            'SELECT damage_photos, damage_notes FROM parking_sessions WHERE id = $1',
            [sessionId]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 })
        }

        const { damage_photos, damage_notes } = result.rows[0]

        return NextResponse.json({
            photos: damage_photos || [],
            damage_notes: damage_notes || null,
            total: (damage_photos || []).length,
        })
    } catch (error) {
        console.error('Damage photos fetch error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
