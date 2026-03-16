import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isAdminLike } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/staff/duty-assignments
 *
 * Returns all staff grouped by venue → gate → zone with their current assignments.
 * Used by the StaffTab duty board section.
 */
export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const callerResult = await pool.query(
            `SELECT u.id, u.role, u.venue_id FROM users u
       INNER JOIN sessions s ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
            [authToken]
        );

        if (callerResult.rows.length === 0 || !isAdminLike(callerResult.rows[0].role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const caller = callerResult.rows[0];

        // ── Fetch venues (supervisors see only their own venue) ────────────
        let venueFilter = '';
        const params: string[] = [];
        if (caller.role === 'supervisor' && caller.venue_id) {
            venueFilter = 'WHERE v.id = $1';
            params.push(caller.venue_id);
        }

        const venuesResult = await pool.query(
            `SELECT v.id, v.name FROM venues v ${venueFilter} ORDER BY v.name`,
            params
        );

        const venues = [];

        for (const venue of venuesResult.rows) {
            // Fetch supervisor for this venue
            const supervisorResult = await pool.query(
                `SELECT id, full_name, email, phone
         FROM users WHERE venue_id = $1 AND role = 'supervisor' AND status = 'active'
         LIMIT 1`,
                [venue.id]
            );

            // Fetch gates → zones hierarchy
            const gatesResult = await pool.query(
                `SELECT id, name, display_order FROM gates WHERE venue_id = $1 ORDER BY display_order`,
                [venue.id]
            );

            const gates = [];
            for (const gate of gatesResult.rows) {
                const zonesResult = await pool.query(
                    `SELECT z.id, z.name, z.total_slots FROM zones z
           WHERE z.gate_id = $1 ORDER BY z.name`,
                    [gate.id]
                );

                const zones = [];
                for (const zone of zonesResult.rows) {
                    // Fetch staff assigned to this zone
                    const staffResult = await pool.query(
                        `SELECT id, full_name, email, phone, role
             FROM users
             WHERE zone_id = $1 AND role IN ('driver', 'washer') AND status = 'active'
             ORDER BY role, full_name`,
                        [zone.id]
                    );

                    zones.push({
                        id: zone.id,
                        name: zone.name,
                        total_slots: zone.total_slots,
                        staff: staffResult.rows,
                    });
                }

                gates.push({
                    id: gate.id,
                    name: gate.name,
                    zones,
                });
            }

            // Fetch unassigned staff (at this venue but no zone)
            const unassignedResult = await pool.query(
                `SELECT id, full_name, email, phone, role
         FROM users
         WHERE venue_id = $1 AND zone_id IS NULL AND role IN ('driver', 'washer') AND status = 'active'
         ORDER BY role, full_name`,
                [venue.id]
            );

            venues.push({
                id: venue.id,
                name: venue.name,
                supervisor: supervisorResult.rows[0] || null,
                gates,
                unassigned_staff: unassignedResult.rows,
            });
        }

        return NextResponse.json({ venues });
    } catch (error) {
        console.error('GET /api/admin/staff/duty-assignments error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
