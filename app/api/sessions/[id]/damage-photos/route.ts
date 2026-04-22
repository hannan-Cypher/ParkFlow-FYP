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

        // SWITCHED TO JSON: multipart/form-data parsing was failing through VPS proxy in Next.js 15
        const body = await request.json()
        const { photos, damage_notes } = body as {
            photos: Array<{ data: string; label?: string }>,
            damage_notes?: string
        }

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

        const timestamp = Date.now()
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'damage')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }

        // Process photos in parallel
        const savePromises = photos.map(async (photo, i) => {
            const { data, label } = photo
            // Expecting data: "data:image/jpeg;base64,..." or just base64 string
            const base64Data = data.includes('base64,') ? data.split('base64,')[1] : data
            const mimeMatch = data.match(/:(.*?);/)
            const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'jpg'

            const filename = `${sessionId}_${timestamp}_${i}.${ext === 'jpeg' ? 'jpg' : ext}`
            const filepath = path.join(uploadDir, filename)

            const buffer = Buffer.from(base64Data, 'base64')
            await fs.promises.writeFile(filepath, buffer)

            return {
                url: `/uploads/damage/${filename}`,
                label: label || `Photo ${i + 1}`,
                timestamp: new Date().toISOString(),
            }
        })

        const savedPhotos = await Promise.all(savePromises)


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
