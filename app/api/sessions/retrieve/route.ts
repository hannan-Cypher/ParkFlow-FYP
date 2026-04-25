import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { findAvailableStaff } from '@/lib/staffAssignment';

export const dynamic = 'force-dynamic';


/**
 * POST /api/sessions/retrieve
 *
 * Customer requests vehicle retrieval.
 * This marks the session for retrieval and assigns the valet staff to bring the car.
 *
 * Body:
 *   session_id — UUID of the active parking session
 */
export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        const body = await request.json();
        const { session_id } = body;

        if (!session_id) {
            return NextResponse.json(
                { error: 'session_id is required' },
                { status: 400 }
            );
        }

        await client.query('BEGIN');

        // ── 1. Find the active session ──────────────────────────────────────────
        const sessionResult = await client.query(
            `SELECT ps.*, v.license_plate, v.make, v.model, v.color, v.vehicle_type,
                    sl.slot_number, sl.floor_level, sl.zone, sl.zone_id as slot_zone_id,
                    ve.name as venue_name, ve.id as v_venue_id,
                    staff.full_name as staff_name
             FROM parking_sessions ps
             JOIN vehicles v ON v.id = ps.vehicle_id
             LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
             LEFT JOIN venues ve ON ve.id = ps.venue_id
             LEFT JOIN users staff ON staff.id = ps.valet_staff_id
             WHERE ps.id = $1 AND ps.status = 'active'
             FOR UPDATE OF ps`,
            [session_id]
        );

        if (sessionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(
                { error: 'No active parking session found' },
                { status: 404 }
            );
        }

        const session = sessionResult.rows[0];

        // ── 2. Check if already requested ───────────────────────────────────────
        if (session.retrieval_status === 'requested' || session.retrieval_status === 'in_progress') {
            await client.query('ROLLBACK');
            return NextResponse.json(
                { error: 'Vehicle retrieval has already been requested', retrieval_status: session.retrieval_status },
                { status: 409 }
            );
        }

        // ── 3. Find available staff (zone-pinned, venue fallback) ──────────────
        const assignedStaffResult = await findAvailableStaff(client, {
            venueId: session.v_venue_id,
            zoneId: session.slot_zone_id || undefined,
            requiredRole: 'driver',
        });
        const assignedStaff = assignedStaffResult.id
            ? { id: assignedStaffResult.id, full_name: assignedStaffResult.full_name }
            : null;

        // ── 4. Update session with retrieval status ─────────────────────────────
        const updateFields = assignedStaff
            ? `retrieval_status = 'requested',
                 retrieval_requested_at = NOW(),
                 valet_staff_id = $2`
            : `retrieval_status = 'requested',
                 retrieval_requested_at = NOW()`;
        const updateParams = assignedStaff ? [session_id, assignedStaff.id] : [session_id];

        await client.query(
            `UPDATE parking_sessions
             SET ${updateFields}
             WHERE id = $1`,
            updateParams
        );

        await client.query('COMMIT');

        return NextResponse.json(
            {
                message: 'Vehicle retrieval requested successfully',
                retrieval: {
                    session_id: session.id,
                    status: 'requested',
                    requested_at: new Date().toISOString(),
                    vehicle: {
                        license_plate: session.license_plate,
                        make: session.make,
                        model: session.model,
                        color: session.color,
                    },
                    slot: {
                        slot_number: session.slot_number,
                        floor_level: session.floor_level,
                        zone: session.zone,
                    },
                    venue: session.venue_name,
                    assigned_staff: assignedStaff ? assignedStaff.full_name : null,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Retrieval request error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}

/**
 * GET /api/sessions/retrieve?session_id=xxx
 *
 * Check retrieval status for a session.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const session_id = searchParams.get('session_id');

        if (!session_id) {
            return NextResponse.json(
                { error: 'session_id is required' },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `SELECT ps.retrieval_status, ps.retrieval_requested_at,
                    v.license_plate,
                    sl.slot_number, sl.floor_level, sl.zone,
                    staff.full_name as staff_name
             FROM parking_sessions ps
             JOIN vehicles v ON v.id = ps.vehicle_id
             LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
             LEFT JOIN users staff ON staff.id = ps.valet_staff_id
             WHERE ps.id = $1`,
            [session_id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Session not found' },
                { status: 404 }
            );
        }

        const row = result.rows[0];

        return NextResponse.json({
            retrieval_status: row.retrieval_status,
            requested_at: row.retrieval_requested_at,
            vehicle: { license_plate: row.license_plate },
            slot: {
                slot_number: row.slot_number,
                floor_level: row.floor_level,
                zone: row.zone,
            },
            assigned_staff: row.staff_name,
        });
    } catch (error) {
        console.error('Retrieval status error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
