import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isStaffRole, isAdminLike } from '@/lib/roles';
import { validateAssignment } from '@/lib/duty-assignment';

export const dynamic = 'force-dynamic';


/**
 * POST /api/staff/assign
 *
 * Assign a staff member to a venue + zone (or just venue for supervisors).
 *
 * Body:
 *   staff_id  (required) — UUID of the staff user
 *   venue_id  (required) — UUID of the venue (null to unassign)
 *   zone_id   (optional) — UUID of the zone within the venue (driver/washer only)
 */
export async function POST(request: NextRequest) {
    try {
        // ── Authenticate caller ──────────────────────────────────────────
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const callerResult = await pool.query(
            `SELECT u.id, u.role FROM users u
             INNER JOIN sessions s ON u.id = s.user_id
             WHERE s.token = $1 AND s.expires_at > NOW()`,
            [authToken]
        );

        if (callerResult.rows.length === 0) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const caller = callerResult.rows[0];
        if (!isAdminLike(caller.role)) {
            return NextResponse.json({ error: 'Only admin or supervisor can assign staff' }, { status: 403 });
        }

        // ── Parse body ───────────────────────────────────────────────────
        const body = await request.json();
        const { staff_id, venue_id, zone_id } = body;

        if (!staff_id) {
            return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
        }

        // ── Verify the staff member exists and is staff ──────────────────
        const staffCheck = await pool.query(
            `SELECT id, full_name, role FROM users WHERE id = $1`,
            [staff_id]
        );

        if (staffCheck.rows.length === 0) {
            return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
        }

        const staffMember = staffCheck.rows[0];
        if (!isStaffRole(staffMember.role)) {
            return NextResponse.json({ error: 'User is not a staff member' }, { status: 400 });
        }

        // ── Validate assignment using business logic ─────────────────────
        const validation = validateAssignment({
            staff_id,
            staff_role: staffMember.role,
            venue_id: venue_id || null,
            zone_id: zone_id || null,
            caller_role: caller.role,
        });

        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        // ── Verify venue exists (if assigning) ──────────────────────────
        if (validation.resolved_venue_id) {
            const venueCheck = await pool.query(
                `SELECT id, name FROM venues WHERE id = $1`,
                [validation.resolved_venue_id]
            );
            if (venueCheck.rows.length === 0) {
                return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
            }
        }

        // ── Verify zone belongs to venue (if assigning) ──────────────────
        if (validation.resolved_zone_id) {
            const zoneCheck = await pool.query(
                `SELECT id, name FROM zones WHERE id = $1 AND venue_id = $2`,
                [validation.resolved_zone_id, validation.resolved_venue_id]
            );
            if (zoneCheck.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Zone not found in this venue' },
                    { status: 404 }
                );
            }
        }

        // ── Enforce 1 Supervisor per Venue ───────────────────────────────
        if (staffMember.role === 'supervisor' && validation.resolved_venue_id) {
            // Unassign any existing supervisors from this venue before assigning the new one
            await pool.query(
                `UPDATE users SET venue_id = NULL 
                 WHERE role = 'supervisor' AND venue_id = $1 AND id != $2`,
                [validation.resolved_venue_id, staff_id]
            );
        }

        // ── Update the staff member ──────────────────────────────────────
        const result = await pool.query(
            `UPDATE users SET venue_id = $1, zone_id = $2 WHERE id = $3
             RETURNING id, full_name, email, phone, venue_id, zone_id`,
            [validation.resolved_venue_id, validation.resolved_zone_id, staff_id]
        );

        const updated = result.rows[0];

        // ── Audit log ────────────────────────────────────────────────────
        if (validation.resolved_venue_id) {
            await pool.query(
                `INSERT INTO staff_duty_assignments (staff_id, venue_id, zone_id, assigned_by, role)
                 VALUES ($1, $2, $3, $4, $5)`,
                [staff_id, validation.resolved_venue_id, validation.resolved_zone_id, caller.id, staffMember.role]
            );
        }

        // ── Build response ───────────────────────────────────────────────
        let venueName = null;
        let zoneName = null;

        if (updated.venue_id) {
            const venueRes = await pool.query('SELECT name FROM venues WHERE id = $1', [updated.venue_id]);
            venueName = venueRes.rows[0]?.name || null;
        }
        if (updated.zone_id) {
            const zoneRes = await pool.query('SELECT name FROM zones WHERE id = $1', [updated.zone_id]);
            zoneName = zoneRes.rows[0]?.name || null;
        }

        return NextResponse.json(
            {
                message: `Staff member ${updated.full_name} ${venue_id ? 'assigned' : 'unassigned'} successfully`,
                staff: {
                    id: updated.id,
                    full_name: updated.full_name,
                    email: updated.email,
                    phone: updated.phone,
                    venue: updated.venue_id
                        ? { id: updated.venue_id, name: venueName }
                        : null,
                    zone: updated.zone_id
                        ? { id: updated.zone_id, name: zoneName }
                        : null,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Staff assign error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
