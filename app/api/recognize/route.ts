import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recognize
 *
 * Receives license plate detections from the Mac's AI processor
 * (camera_streamer.py) and logs them to the `anpr_logs` table.
 *
 * Expected JSON body:
 *   { plate: string, confidence: number, method: string, secret: string }
 *
 * Security: Requires a shared secret that matches ANPR_WEBHOOK_SECRET env var.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { plate, confidence, method, secret, venue_id, gate_id } = body;

        // ── Authentication ──────────────────────────────────────────────
        const expectedSecret = process.env.ANPR_WEBHOOK_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // ── Validation ──────────────────────────────────────────────────
        if (!plate || typeof plate !== 'string') {
            return NextResponse.json(
                { error: 'plate (string) is required' },
                { status: 400 }
            );
        }

        const normalizedPlate = plate.trim().toUpperCase().replace(/\s+/g, '');

        // ── Insert into anpr_logs table ─────────────────────────────────
        // This table acts as a real-time feed of detected plates.
        // The frontend can query this to show live camera detections.
        const result = await pool.query(
            `INSERT INTO anpr_logs (plate_number, confidence, ocr_method, detected_at, venue_id, gate_id)
             VALUES ($1, $2, $3, NOW(), $4, $5)
             RETURNING id, plate_number, confidence, ocr_method, detected_at, venue_id, gate_id`,
            [normalizedPlate, confidence ?? null, method ?? null, venue_id ?? null, gate_id ?? null]
        );

        const log = result.rows[0];

        console.log(`[ANPR Recognize] Plate detected: ${normalizedPlate} (conf=${confidence}, method=${method})`);

        return NextResponse.json({
            success: true,
            log: {
                id: log.id,
                plate_number: log.plate_number,
                confidence: log.confidence ? Number(log.confidence) : null,
                ocr_method: log.ocr_method,
                detected_at: log.detected_at,
                venue_id: log.venue_id ?? null,
                gate_id: log.gate_id ?? null,
            },
        }, { status: 201 });

    } catch (error: any) {
        console.error('[ANPR Recognize] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/recognize
 *
 * Returns the last N detected plates (for the dashboard live feed).
 * Query params: ?limit=10
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
        const venueFilter = searchParams.get('venue_id');

        const result = venueFilter
            ? await pool.query(
                `SELECT id, plate_number, confidence, ocr_method, detected_at, venue_id, gate_id
                 FROM anpr_logs
                 WHERE (venue_id = $1 OR venue_id IS NULL)
                   AND detected_at > NOW() - INTERVAL '5 minutes'
                 ORDER BY detected_at DESC
                 LIMIT $2`,
                [venueFilter, limit]
            )
            : await pool.query(
                `SELECT id, plate_number, confidence, ocr_method, detected_at, venue_id, gate_id
                 FROM anpr_logs
                 ORDER BY detected_at DESC
                 LIMIT $1`,
                [limit]
            );

        return NextResponse.json({
            success: true,
            detections: result.rows.map(row => ({
                id: row.id,
                plate_number: row.plate_number,
                confidence: row.confidence ? Number(row.confidence) : null,
                ocr_method: row.ocr_method,
                detected_at: row.detected_at,
                venue_id: row.venue_id ?? null,
                gate_id: row.gate_id ?? null,
            })),
        });

    } catch (error: any) {
        console.error('[ANPR Recognize] GET Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
