import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * GET /api/admin/analytics
 *
 * Returns analytics data for the admin dashboard:
 *   - Daily revenue for the last 7 days
 *   - Top 5 staff members by completed sessions
 *   - Average rating per venue
 */
export async function GET(_request: NextRequest) {
    try {
        // ── Daily revenue for last 7 days ──────────────────────────────────────
        const dailyRevenueResult = await pool.query(`
            SELECT day, date, SUM(sessions)::int AS sessions, COALESCE(SUM(revenue), 0) AS revenue
            FROM (
                -- Parking revenue
                SELECT
                    TO_CHAR(exit_time::date, 'Mon DD') AS day,
                    exit_time::date                    AS date,
                    COUNT(*)                           AS sessions,
                    SUM(total_amount)                  AS revenue
                FROM parking_sessions
                WHERE status = 'completed'
                  AND exit_time >= NOW() - INTERVAL '7 days'
                GROUP BY exit_time::date
                UNION ALL
                -- Wash service revenue
                SELECT
                    TO_CHAR(completed_at::date, 'Mon DD') AS day,
                    completed_at::date                    AS date,
                    0                                     AS sessions,
                    SUM(service_cost)                     AS revenue
                FROM service_requests
                WHERE service_type = 'wash'
                  AND service_status = 'completed'
                  AND completed_at >= NOW() - INTERVAL '7 days'
                GROUP BY completed_at::date
            ) combined
            GROUP BY day, date
            ORDER BY date ASC
        `);

        // Fill in missing days with zero so chart always shows 7 bars
        const last7Days: { day: string; date: string; sessions: number; revenue: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
            const found = dailyRevenueResult.rows.find((r) => r.date.toISOString().split('T')[0] === dateStr);
            last7Days.push({
                day: dayLabel,
                date: dateStr,
                sessions: found ? Number(found.sessions) : 0,
                revenue: found ? Number(found.revenue) : 0,
            });
        }

        // ── Top 5 staff by completed sessions ──────────────────────────────────
        const topStaffResult = await pool.query(`
            SELECT
                u.full_name,
                COUNT(ps.id)::int                                    AS completed,
                ROUND(AVG(ps.total_hours)::numeric, 1)               AS avg_hours,
                COALESCE(ROUND(AVG(ps.rating)::numeric, 1), 0)       AS avg_rating
            FROM users u
            JOIN parking_sessions ps ON ps.valet_staff_id = u.id
            WHERE u.role IN ('driver', 'washer', 'supervisor')
              AND ps.status = 'completed'
            GROUP BY u.id, u.full_name
            ORDER BY completed DESC
            LIMIT 5
        `);

        // ── Average rating per venue ──────────────────────────────────────────
        const venueRatingsResult = await pool.query(`
            SELECT
                ve.name                                              AS venue,
                COUNT(ps.id)::int                                    AS total_sessions,
                COUNT(ps.rating)::int                                AS rated_sessions,
                COALESCE(ROUND(AVG(ps.rating)::numeric, 1), 0)       AS avg_rating
            FROM venues ve
            LEFT JOIN parking_sessions ps ON ps.venue_id = ve.id AND ps.status = 'completed'
            GROUP BY ve.id, ve.name
            ORDER BY total_sessions DESC
        `);

        return NextResponse.json({
            dailyRevenue: last7Days,
            topStaff: topStaffResult.rows.map((r) => ({
                name: r.full_name,
                completed: r.completed,
                avgHours: r.avg_hours ? Number(r.avg_hours) : null,
                avgRating: Number(r.avg_rating),
            })),
            venueRatings: venueRatingsResult.rows.map((r) => ({
                venue: r.venue,
                totalSessions: r.total_sessions,
                ratedSessions: r.rated_sessions,
                avgRating: Number(r.avg_rating),
            })),
        });
    } catch (error) {
        console.error('Analytics error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
