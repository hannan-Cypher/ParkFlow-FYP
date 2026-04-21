import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * PATCH /api/sessions/[id]/retrieval
 *
 * Staff updates retrieval status for an active parking session.
 *
 * Body: { status: 'in_progress' | 'ready' }
 *
 * - in_progress : staff has collected the car from the slot and is driving it to the pickup point
 * - ready       : car has been delivered to the pickup point →
 *                 triggers automatic checkout (calculates bill, frees slot, marks completed)
 *                 + inserts a customer notification
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const client = await pool.connect();
    try {
        const { id: sessionId } = await params;
        const body = await request.json();
        const { status, staff_id } = body;

        if (!status || !['in_progress', 'ready'].includes(status)) {
            return NextResponse.json(
                { error: "status must be 'in_progress' or 'ready'" },
                { status: 400 }
            );
        }

        await client.query('BEGIN');

        // Fetch active session with row-level lock
        const sessionResult = await client.query(
            `SELECT ps.*,
                    v.license_plate, v.make, v.model, v.color,
                    sl.slot_number, sl.floor_level, sl.zone,
                    ve.name   AS venue_name,
                    cu.id     AS cu_id,
                    cu.full_name AS cu_name
             FROM parking_sessions ps
             JOIN vehicles v       ON v.id  = ps.vehicle_id
             LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
             LEFT JOIN venues ve   ON ve.id = ps.venue_id
             LEFT JOIN users cu    ON cu.id = ps.customer_id
             WHERE ps.id = $1 AND ps.status = 'active'
             FOR UPDATE OF ps`,
            [sessionId]
        );

        if (sessionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(
                { error: 'No active parking session found' },
                { status: 404 }
            );
        }

        const session = sessionResult.rows[0];

        // ── in_progress: staff started driving the car ───────────────────────
        if (status === 'in_progress') {
            await client.query(
                `UPDATE parking_sessions SET retrieval_status = 'in_progress', retrieval_staff_id = $2 WHERE id = $1`,
                [sessionId, staff_id || null]
            );
            await client.query('COMMIT');
            return NextResponse.json({
                message: 'Retrieval started — staff is bringing the car',
                retrieval_status: 'in_progress',
                retrieval_staff_id: staff_id || null,
            });
        }

        // ── ready: car delivered → auto-checkout ─────────────────────────────
        const exitTime = new Date();
        const entryTime = new Date(session.entry_time);
        const durationMs = exitTime.getTime() - entryTime.getTime();
        const totalHours = Math.max(durationMs / (1000 * 60 * 60), 0.01);
        const ratePerHour = Number(session.rate_per_hour) || 100;
        const billedHours = Math.max(Math.ceil(totalHours), 1);
        const parkingAmount = billedHours * ratePerHour;

        // Add completed wash costs
        const washResult = await client.query(
            `SELECT COALESCE(SUM(service_cost), 0) AS wash_total
             FROM service_requests
             WHERE session_id = $1
               AND service_type = 'wash'
               AND service_status = 'completed'`,
            [sessionId]
        );
        const washAmount = Number(washResult.rows[0].wash_total);
        const totalAmount = parkingAmount + washAmount;

        const h = Math.floor(totalHours);
        const m = Math.round((totalHours - h) * 60);
        const durationDisplay = h > 0 ? `${h}h ${m}m` : `${m}m`;

        // Free the slot
        if (session.slot_id) {
            await client.query(
                `UPDATE parking_slots SET status = 'available' WHERE id = $1`,
                [session.slot_id]
            );
        }

        // Complete the session
        await client.query(
            `UPDATE parking_sessions
             SET exit_time        = $1,
                 total_hours      = $2,
                 total_amount     = $3,
                 status           = 'completed',
                 payment_status   = 'completed',
                 retrieval_status = 'ready',
                 retrieval_staff_id = COALESCE($5, retrieval_staff_id)
             WHERE id = $4`,
            [exitTime.toISOString(), totalHours.toFixed(2), parkingAmount.toFixed(2), sessionId, staff_id || null]
        );

        // Notify customer
        if (session.cu_id) {
            await client.query(
                `INSERT INTO notifications (user_id, title, message, type, related_session_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    session.cu_id,
                    'Your Car Has Arrived!',
                    `${session.license_plate} is waiting at the pickup point. Duration: ${durationDisplay}. Total: PKR ${Math.round(totalAmount)}${washAmount > 0 ? ` (Parking: ${Math.round(parkingAmount)} + Wash: ${Math.round(washAmount)})` : ''}.`,
                    'car_ready',
                    sessionId,
                ]
            );
        }

        await client.query('COMMIT');

        return NextResponse.json({
            message: 'Car delivered — checkout complete',
            session: {
                id: sessionId,
                status: 'completed',
                retrieval_status: 'ready',
                exit_time: exitTime.toISOString(),
                duration: durationDisplay,
                total_hours: Number(totalHours.toFixed(2)),
                billed_hours: billedHours,
                rate_per_hour: ratePerHour,
                parking_amount: Math.round(parkingAmount),
                wash_amount: Math.round(washAmount),
                total_amount: Math.round(totalAmount),
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
            },
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Retrieval update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    } finally {
        client.release();
    }
}
