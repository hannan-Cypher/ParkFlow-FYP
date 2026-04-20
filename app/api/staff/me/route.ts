import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { getAuthUser } from '@/lib/getUser'

export const dynamic = 'force-dynamic';


/**
 * GET /api/staff/me
 *
 * Returns the current logged-in staff member's details,
 * including their venue assignment and task stats.
 * Requires authentication (session cookie).
 */
export async function GET(request: NextRequest) {
    try {
        const rawCookie = request.cookies.get('auth_token')?.value;
        console.log('[staff/me] cookie present:', !!rawCookie, '| cookie length:', rawCookie?.length ?? 0);
        const user = await getAuthUser(request)
        console.log('[staff/me] auth result:', user ? `OK (id=${user.id}, role=${user.role})` : 'NULL (no valid session)');

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get full staff info with venue
        const result = await pool.query(
            `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.role,
        u.venue_id,
        u.is_active,
        v.name as venue_name,
        v.city as venue_city
      FROM users u
      LEFT JOIN venues v ON v.id = u.venue_id
      WHERE u.id = $1`,
            [user.id]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const staff = result.rows[0]

        // Get task stats
        const statsResult = await pool.query(
            `SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_tasks,
        COUNT(*) FILTER (WHERE status = 'completed' AND exit_time::date = CURRENT_DATE) as completed_today,
        COUNT(*) FILTER (WHERE status = 'completed') as total_completed
      FROM parking_sessions
      WHERE valet_staff_id = $1`,
            [user.id]
        )

        const stats = statsResult.rows[0]

        return NextResponse.json({
            staff: {
                id: staff.id,
                full_name: staff.full_name,
                email: staff.email,
                phone: staff.phone,
                role: staff.role,
                is_active: staff.is_active,
                venue: staff.venue_id
                    ? {
                        id: staff.venue_id,
                        name: staff.venue_name,
                        city: staff.venue_city,
                    }
                    : null,
            },
            stats: {
                active_tasks: Number(stats.active_tasks),
                completed_today: Number(stats.completed_today),
                total_completed: Number(stats.total_completed),
            },
        })
    } catch (error) {
        console.error('Staff me error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
