import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

export const dynamic = 'force-dynamic';


/**
 * GET /api/wash/stats
 *
 * Returns wash statistics for the current washer.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'washer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE service_status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE service_status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE service_status = 'completed' AND completed_at::date = CURRENT_DATE) AS completed_today,
        COUNT(*) FILTER (WHERE service_status = 'completed') AS total_completed,
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)
          FILTER (WHERE service_status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL),
          0
        ) AS avg_duration_minutes
      FROM service_requests
      WHERE assigned_to = $1 AND service_type = 'wash'`,
      [user.id]
    );

    const stats = result.rows[0];

    return NextResponse.json({
      stats: {
        pending: Number(stats.pending),
        in_progress: Number(stats.in_progress),
        completed_today: Number(stats.completed_today),
        total_completed: Number(stats.total_completed),
        avg_duration_minutes: Math.round(Number(stats.avg_duration_minutes)),
      },
    });
  } catch (err) {
    console.error('GET /api/wash/stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
