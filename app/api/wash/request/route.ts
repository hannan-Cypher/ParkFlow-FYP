import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { WASH_PRICING } from '@/lib/roles';
import type { WashType } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * POST /api/wash/request
 *
 * Customer-facing endpoint to book a wash service for an active parking session.
 *
 * Body: { session_id, wash_type: 'basic'|'full'|'premium', notes? }
 */
export async function POST(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'customer') {
        return NextResponse.json({ error: 'Forbidden — customers only' }, { status: 403 });
    }

    try {
        const { session_id, wash_type, notes } = await request.json();

        // ── Validation ────────────────────────────────────────────────────────────
        if (!session_id) {
            return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
        }
        if (!wash_type || !['basic', 'full', 'premium'].includes(wash_type)) {
            return NextResponse.json({ error: 'wash_type must be basic, full, or premium' }, { status: 400 });
        }

        // ── Verify session exists, is active, and belongs to this customer ───────
        const sessionRes = await pool.query(
            `SELECT ps.id, ps.vehicle_id, ps.customer_id, ps.venue_id, ps.slot_id
       FROM parking_sessions ps
       WHERE ps.id = $1 AND ps.status = 'active'`,
            [session_id]
        );

        if (sessionRes.rows.length === 0) {
            return NextResponse.json({ error: 'Active parking session not found' }, { status: 404 });
        }

        const session = sessionRes.rows[0];

        // Ownership check: customer_id on the session must match logged-in user
        if (session.customer_id !== user.id) {
            return NextResponse.json({ error: 'This session does not belong to you' }, { status: 403 });
        }

        // ── Block duplicate pending/in_progress wash ─────────────────────────────
        const existingWash = await pool.query(
            `SELECT id FROM service_requests
       WHERE session_id = $1 AND service_type = 'wash' AND service_status IN ('pending', 'in_progress')`,
            [session_id]
        );
        if (existingWash.rows.length > 0) {
            return NextResponse.json(
                { error: 'A wash is already in progress for this session' },
                { status: 409 }
            );
        }

        // ── Auto-assign least-busy washer at the venue ──────────────────────────
        const washerRes = await pool.query(
            `SELECT u.id, u.full_name,
              COUNT(sr.id) FILTER (WHERE sr.service_status IN ('pending', 'in_progress')) AS active_tasks
       FROM users u
       LEFT JOIN service_requests sr ON sr.assigned_to = u.id AND sr.service_status IN ('pending', 'in_progress')
       WHERE u.role = 'washer'
         AND u.venue_id = $1
         AND u.is_active = true
       GROUP BY u.id, u.full_name
       ORDER BY active_tasks ASC, u.full_name ASC
       LIMIT 1`,
            [session.venue_id]
        );

        const assignedWasher = washerRes.rows[0] || null;

        if (!assignedWasher) {
            return NextResponse.json(
                { error: 'No washers are available at this venue right now. Please try again later.' },
                { status: 503 }
            );
        }

        const pricing = WASH_PRICING[wash_type as WashType];

        // ── Insert service request ──────────────────────────────────────────────
        const result = await pool.query(
            `INSERT INTO service_requests
        (session_id, customer_id, service_type, service_status, assigned_to,
         service_cost, notes, wash_type, vehicle_id, venue_id, slot_id)
       VALUES ($1, $2, 'wash', 'pending', $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, service_status, assigned_to, service_cost, wash_type, created_at`,
            [
                session_id,
                user.id,
                assignedWasher.id,
                pricing.cost,
                notes || null,
                wash_type,
                session.vehicle_id,
                session.venue_id,
                session.slot_id,
            ]
        );

        // ── Notify assigned washer ──────────────────────────────────────────────
        await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, related_session_id)
       VALUES ($1, $2, $3, 'wash_assigned', $4)`,
            [
                assignedWasher.id,
                `New ${pricing.label} Assigned`,
                `A customer has requested a ${pricing.label}. Check your tasks.`,
                session_id,
            ]
        );

        return NextResponse.json(
            {
                request: {
                    id: result.rows[0].id,
                    wash_type: result.rows[0].wash_type,
                    service_status: result.rows[0].service_status,
                    service_cost: result.rows[0].service_cost,
                    assigned_to_name: assignedWasher.full_name,
                },
            },
            { status: 201 }
        );
    } catch (err) {
        console.error('POST /api/wash/request error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
