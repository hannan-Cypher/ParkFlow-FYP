import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { isAdminLike } from '@/lib/roles';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isAdminLike(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staff_id') || null;
  const venueId = searchParams.get('venue_id') || null;
  const date = searchParams.get('date') || null; // YYYY-MM-DD

  try {
    const result = await pool.query(
      `SELECT
         ss.id,
         ss.shift_start,
         ss.shift_end,
         ss.status,
         ss.total_break_minutes,
         ss.created_at,
         u.full_name AS staff_name,
         u.phone     AS staff_phone,
         v.name      AS venue_name
       FROM staff_shifts ss
       JOIN users  u ON u.id = ss.staff_id
       JOIN venues v ON v.id = ss.venue_id
       WHERE ($1::uuid IS NULL OR ss.staff_id = $1)
         AND ($2::uuid IS NULL OR ss.venue_id = $2)
         AND ($3::date IS NULL OR ss.shift_start::date = $3::date)
       ORDER BY ss.shift_start DESC
       LIMIT 100`,
      [staffId, venueId, date]
    );

    const shifts = result.rows.map((r) => {
      const totalMs = r.shift_end
        ? new Date(r.shift_end).getTime() - new Date(r.shift_start).getTime()
        : null;
      const totalMinutes = totalMs !== null ? Math.floor(totalMs / 60000) : null;
      const netMinutes =
        totalMinutes !== null ? totalMinutes - r.total_break_minutes : null;

      return {
        id: r.id,
        staff_name: r.staff_name,
        staff_phone: r.staff_phone,
        venue_name: r.venue_name,
        shift_start: r.shift_start,
        shift_end: r.shift_end,
        status: r.status,
        total_break_minutes: r.total_break_minutes,
        total_minutes: totalMinutes,
        net_minutes: netMinutes,
      };
    });

    return NextResponse.json({ shifts });
  } catch (err) {
    console.error('admin/shifts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
