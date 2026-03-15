import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const result = await pool.query(
      `SELECT ss.*,
              v.max_break_minutes,
              v.shift_start_time::text       AS shift_start_time,
              v.shift_end_time::text         AS shift_end_time,
              v.enforce_shift_start_window
       FROM staff_shifts ss
       JOIN venues v ON v.id = ss.venue_id
       WHERE ss.staff_id = $1 AND ss.status IN ('active', 'on_break', 'pending_approval', 'rejected')
       ORDER BY ss.created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (result.rows.length === 0) {
      // Return venue config even when no active shift so the gate can show shift hours
      const venueRes = await pool.query(
        `SELECT max_break_minutes, shift_start_time::text, shift_end_time::text,
                enforce_shift_start_window
         FROM venues WHERE id = $1`,
        [user.venue_id]
      );
      return NextResponse.json({
        shift: null,
        venueConfig: venueRes.rows[0] ?? {
          max_break_minutes: 30,
          shift_start_time: '09:00',
          shift_end_time: '18:00',
          enforce_shift_start_window: true,
        },
      });
    }

    const row = result.rows[0];
    return NextResponse.json({
      shift: {
        id: row.id,
        shift_start: row.shift_start,
        status: row.status,
        break_start: row.break_start,
        total_break_minutes: row.total_break_minutes,
        is_late: row.is_late,
        late_minutes: row.late_minutes,
        admin_approval: row.admin_approval,
        admin_approval_at: row.admin_approval_at,
      },
      venueConfig: {
        max_break_minutes: row.max_break_minutes,
        shift_start_time: row.shift_start_time,
        shift_end_time: row.shift_end_time,
        enforce_shift_start_window: row.enforce_shift_start_window,
      },
    });
  } catch (err) {
    console.error('shift/current error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
