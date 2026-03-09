import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/staff/assign
 *
 * Assign a staff member to a venue, or reassign them.
 *
 * Body:
 *   staff_id  (required) — UUID of the staff user
 *   venue_id  (required) — UUID of the venue to assign to (null to unassign)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { staff_id, venue_id } = body;

        if (!staff_id) {
            return NextResponse.json(
                { error: 'staff_id is required' },
                { status: 400 }
            );
        }

        // Verify the staff member exists and is a valet_staff
        const staffCheck = await pool.query(
            `SELECT id, full_name, role FROM users WHERE id = $1`,
            [staff_id]
        );

        if (staffCheck.rows.length === 0) {
            return NextResponse.json(
                { error: 'Staff member not found' },
                { status: 404 }
            );
        }

        if (staffCheck.rows[0].role !== 'valet_staff') {
            return NextResponse.json(
                { error: 'User is not a valet staff member' },
                { status: 400 }
            );
        }

        // If venue_id is provided, verify venue exists
        if (venue_id) {
            const venueCheck = await pool.query(
                `SELECT id, name FROM venues WHERE id = $1`,
                [venue_id]
            );
            if (venueCheck.rows.length === 0) {
                return NextResponse.json(
                    { error: 'Venue not found' },
                    { status: 404 }
                );
            }
        }

        // Update the staff member's venue assignment
        const result = await pool.query(
            `UPDATE users SET venue_id = $1 WHERE id = $2
             RETURNING id, full_name, email, phone, venue_id`,
            [venue_id || null, staff_id]
        );

        const updated = result.rows[0];

        // Get venue name if assigned
        let venueName = null;
        if (updated.venue_id) {
            const venueRes = await pool.query(
                'SELECT name FROM venues WHERE id = $1',
                [updated.venue_id]
            );
            venueName = venueRes.rows[0]?.name || null;
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
