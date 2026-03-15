import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * GET /api/staff
 *
 * Returns all valet staff with:
 *   - Their assigned venue name
 *   - The count of active sessions they are handling
 *   - The count of sessions completed today
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const venueId = searchParams.get('venue_id');

        let whereClause = "WHERE u.role IN ('driver', 'washer', 'supervisor')";
        const params: string[] = [];
        if (venueId) {
            params.push(venueId);
            whereClause += ` AND u.venue_id = $${params.length}`;
        }

        const result = await pool.query(
            `SELECT
         u.id,
         u.full_name,
         u.email,
         u.phone,
         u.is_active,
         u.venue_id,
         v.name AS venue_name,
         COUNT(ps.id) FILTER (WHERE ps.status = 'active') AS active_tasks,
         COUNT(ps.id) FILTER (
           WHERE ps.status = 'completed'
             AND ps.exit_time::date = CURRENT_DATE
         ) AS completed_today,
         COUNT(ps.id) FILTER (WHERE ps.status = 'completed') AS total_completed
       FROM users u
       LEFT JOIN venues v ON v.id = u.venue_id
       LEFT JOIN parking_sessions ps ON ps.valet_staff_id = u.id
       ${whereClause}
       GROUP BY u.id, u.full_name, u.email, u.phone, u.is_active, u.venue_id, v.name
       ORDER BY u.full_name ASC`,
            params
        );

        const staff = result.rows.map((row) => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            is_active: row.is_active,
            venue: row.venue_id
                ? { id: row.venue_id, name: row.venue_name }
                : null,
            active_tasks: Number(row.active_tasks),
            completed_today: Number(row.completed_today),
            total_completed: Number(row.total_completed),
        }));

        return NextResponse.json({ staff, total: staff.length }, { status: 200 });
    } catch (error) {
        console.error('Staff API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
