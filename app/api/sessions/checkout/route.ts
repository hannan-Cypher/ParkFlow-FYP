import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

export const dynamic = 'force-dynamic';


/**
 * POST /api/sessions/checkout
 *
 * Check out a vehicle: calculate duration & cost, free the parking slot,
 * and mark the session as completed.
 *
 * Body (provide one):
 *   session_id    — UUID of the parking session
 *   license_plate — plate number (will look up the active session)
 */
export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        const user = await getAuthUser(request);
        const body = await request.json();
        const { session_id, license_plate } = body;

        if (!session_id && !license_plate) {
            return NextResponse.json(
                { error: 'Either session_id or license_plate is required' },
                { status: 400 }
            );
        }

        await client.query('BEGIN');

        // ── 1. Find the active session ──────────────────────────────────────────
        let sessionQuery: string;
        let sessionParams: string[];

        if (session_id) {
            sessionQuery = `
        SELECT ps.*, v.license_plate, v.make, v.model, v.color,
               sl.slot_number, sl.floor_level, sl.zone,
               ve.name as venue_name
        FROM parking_sessions ps
        JOIN vehicles v ON v.id = ps.vehicle_id
        LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
        LEFT JOIN venues ve ON ve.id = ps.venue_id
        WHERE ps.id = $1 AND ps.status = 'active'
        FOR UPDATE OF ps`;
            sessionParams = [session_id];
        } else {
            const plate = license_plate.trim().toUpperCase();
            sessionQuery = `
        SELECT ps.*, v.license_plate, v.make, v.model, v.color,
               sl.slot_number, sl.floor_level, sl.zone,
               ve.name as venue_name
        FROM parking_sessions ps
        JOIN vehicles v ON v.id = ps.vehicle_id
        LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
        LEFT JOIN venues ve ON ve.id = ps.venue_id
        WHERE v.license_plate = $1 AND ps.status = 'active'
        FOR UPDATE OF ps`;
            sessionParams = [plate];
        }

        const sessionResult = await client.query(sessionQuery, sessionParams);

        if (sessionResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(
                { error: 'No active parking session found' },
                { status: 404 }
            );
        }

        const session = sessionResult.rows[0];

        // ── 2. Calculate duration & cost ────────────────────────────────────────
        const entryTime = new Date(session.entry_time);
        const exitTime = new Date();
        const durationMs = exitTime.getTime() - entryTime.getTime();
        const totalHours = Math.max(durationMs / (1000 * 60 * 60), 0.01); // minimum 0.01 hours
        const ratePerHour = Number(session.rate_per_hour) || 100;
        // Round up to nearest hour for billing (minimum 1 hour)
        const billedHours = Math.max(Math.ceil(totalHours), 1);
        const parkingAmount = billedHours * ratePerHour;

        // ── 2b. Add completed wash service costs ─────────────────────────────────
        const washResult = await client.query(
            `SELECT COALESCE(SUM(service_cost), 0) AS wash_total
             FROM service_requests
             WHERE session_id = $1
               AND service_type = 'wash'
               AND service_status = 'completed'`,
            [session.id]
        );
        const washAmount = Number(washResult.rows[0].wash_total);
        const totalAmount = parkingAmount + washAmount;

        // ── 3. Free the slot ────────────────────────────────────────────────────
        if (session.slot_id) {
            await client.query(
                `UPDATE parking_slots SET status = 'available' WHERE id = $1`,
                [session.slot_id]
            );
        }

        // ── 4. Complete the session (store parking amount only in DB) ──────────
        await client.query(
            `UPDATE parking_sessions
       SET exit_time = NOW(),
           total_hours = $1,
           total_amount = $2,
           status = 'completed',
           payment_status = 'completed'
       WHERE id = $3`,
            [totalHours.toFixed(2), parkingAmount.toFixed(2), session.id]
        );

        // ── 5. Notify customer ───────────────────────────────────────────────
        if (session.customer_id) {
            const h = Math.floor(totalHours);
            const m = Math.round((totalHours - h) * 60);
            const nd = h > 0 ? `${h}h ${m}m` : `${m}m`;
            await client.query(
                `INSERT INTO notifications (user_id, title, message, type, related_session_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    session.customer_id,
                    'Checkout Complete',
                    `Your ${session.license_plate} has been checked out. Duration: ${nd}. Total: PKR ${Math.round(totalAmount)}${washAmount > 0 ? ` (Parking: ${Math.round(parkingAmount)} + Wash: ${Math.round(washAmount)})` : ''}.`,
                    'checkout',
                    session.id,
                ]
            );
        }

        await client.query('COMMIT');

        // ── Format duration for display ─────────────────────────────────────────
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);
        const durationDisplay =
            hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

        return NextResponse.json(
            {
                message: 'Vehicle checked out successfully',
                session: {
                    id: session.id,
                    status: 'completed',
                    entry_time: session.entry_time,
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
                    venue: {
                        id: session.venue_id,
                        name: session.venue_name,
                    },
                },
            },
            { status: 200 }
        );
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Checkout error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
