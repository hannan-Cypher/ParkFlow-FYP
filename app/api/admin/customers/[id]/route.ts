import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { isAdminLike } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/customers/[id]
 *
 * Fetch full customer details: profile, vehicles, parking sessions, and wash requests.
 * Auth: admin or supervisor only.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    try {
        // ── Customer profile ──────────────────────────────────────────────────
        const customerRes = await pool.query(
            `SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.is_active,
        u.email_verified,
        u.phone_verified,
        u.last_login,
        u.created_at,
        u.updated_at
       FROM users u
       WHERE u.id = $1 AND u.role = 'customer'`,
            [id]
        );

        if (customerRes.rows.length === 0) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const customer = customerRes.rows[0];

        // ── Vehicles ──────────────────────────────────────────────────────────
        const vehiclesRes = await pool.query(
            `SELECT
        v.id,
        v.license_plate,
        v.make,
        v.model,
        v.color,
        v.year,
        v.vehicle_type,
        v.is_primary,
        v.notes,
        v.created_at,
        (SELECT COUNT(*) FROM parking_sessions ps WHERE ps.vehicle_id = v.id) AS session_count
       FROM vehicles v
       WHERE v.owner_id = $1
       ORDER BY v.is_primary DESC, v.created_at DESC`,
            [id]
        );

        // ── Parking sessions ──────────────────────────────────────────────────
        const sessionsRes = await pool.query(
            `SELECT
        ps.id,
        ps.status,
        ps.entry_time,
        ps.exit_time,
        ps.rate_per_hour,
        ps.total_hours,
        ps.total_amount,
        ps.payment_status,
        ps.rating,
        ps.rating_comment,
        ps.retrieval_status,
        v.license_plate,
        v.make AS vehicle_make,
        v.model AS vehicle_model,
        v.color AS vehicle_color,
        ve.name AS venue_name,
        ve.city AS venue_city,
        sl.slot_number,
        sl.floor_level,
        staff.full_name AS staff_name
       FROM parking_sessions ps
       JOIN vehicles v ON v.id = ps.vehicle_id
       LEFT JOIN venues ve ON ve.id = ps.venue_id
       LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
       LEFT JOIN users staff ON staff.id = ps.valet_staff_id
       WHERE ps.customer_id = $1
       ORDER BY ps.entry_time DESC
       LIMIT 50`,
            [id]
        );

        // ── Wash requests ─────────────────────────────────────────────────────
        const washRes = await pool.query(
            `SELECT
        sr.id,
        sr.session_id,
        sr.wash_type,
        sr.service_status,
        sr.service_cost,
        sr.notes,
        sr.started_at,
        sr.completed_at,
        sr.created_at,
        w.full_name AS washer_name
       FROM service_requests sr
       LEFT JOIN users w ON w.id = sr.assigned_to
       WHERE sr.customer_id = $1 AND sr.service_type = 'wash'
       ORDER BY sr.created_at DESC
       LIMIT 20`,
            [id]
        );

        // ── Aggregate stats ───────────────────────────────────────────────────
        const parkingSpent = sessionsRes.rows
            .filter((s) => s.status === 'completed')
            .reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);

        const washSpent = washRes.rows
            .filter((w) => w.service_status === 'completed')
            .reduce((sum, w) => sum + Number(w.service_cost ?? 0), 0);

        const totalSpent = parkingSpent + washSpent;

        const avgRating = sessionsRes.rows
            .filter((s) => s.rating != null)
            .reduce((acc, s, _, arr) => acc + Number(s.rating) / arr.length, 0);

        return NextResponse.json({
            customer: {
                ...customer,
                total_sessions: sessionsRes.rows.length,
                total_spent: Number(totalSpent.toFixed(2)),
                avg_rating: avgRating > 0 ? Number(avgRating.toFixed(1)) : null,
            },
            vehicles: vehiclesRes.rows.map((v) => ({
                id: v.id,
                license_plate: v.license_plate,
                make: v.make,
                model: v.model,
                color: v.color,
                year: v.year,
                vehicle_type: v.vehicle_type,
                is_primary: v.is_primary,
                notes: v.notes,
                created_at: v.created_at,
                session_count: Number(v.session_count),
            })),
            sessions: sessionsRes.rows.map((s) => {
                // Calculate wash amount for this session from wash requests
                const sessionWashAmount = washRes.rows
                    .filter((w) => w.session_id === s.id && w.service_status === 'completed')
                    .reduce((sum, w) => sum + Number(w.service_cost ?? 0), 0);
                return {
                    id: s.id,
                    status: s.status,
                    entry_time: s.entry_time,
                    exit_time: s.exit_time,
                    rate_per_hour: s.rate_per_hour,
                    total_hours: s.total_hours,
                    total_amount: s.total_amount,
                    wash_amount: sessionWashAmount > 0 ? sessionWashAmount : null,
                    payment_status: s.payment_status,
                    rating: s.rating,
                    rating_comment: s.rating_comment,
                    retrieval_status: s.retrieval_status,
                    license_plate: s.license_plate,
                    vehicle_make: s.vehicle_make,
                    vehicle_model: s.vehicle_model,
                    vehicle_color: s.vehicle_color,
                    venue_name: s.venue_name,
                    venue_city: s.venue_city,
                    slot_number: s.slot_number,
                    floor_level: s.floor_level,
                    staff_name: s.staff_name,
                };
            }),
            wash_requests: washRes.rows.map((w) => ({
                id: w.id,
                wash_type: w.wash_type,
                service_status: w.service_status,
                service_cost: w.service_cost,
                notes: w.notes,
                started_at: w.started_at,
                completed_at: w.completed_at,
                created_at: w.created_at,
                washer_name: w.washer_name,
            })),
        });
    } catch (err) {
        console.error('GET /api/admin/customers/[id] error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
