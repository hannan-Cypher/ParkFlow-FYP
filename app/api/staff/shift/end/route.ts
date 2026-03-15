import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const shiftRes = await client.query(
      `SELECT ss.*, v.max_break_minutes
       FROM staff_shifts ss JOIN venues v ON v.id = ss.venue_id
       WHERE ss.staff_id = $1 AND ss.status IN ('active', 'on_break')
       ORDER BY ss.created_at DESC LIMIT 1`,
      [user.id]
    );
    if (shiftRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'No active shift found' }, { status: 409 });
    }
    const shift = shiftRes.rows[0];

    // Block drivers if they have active parking sessions
    if (user.role === 'driver') {
      const sessionCheck = await client.query(
        `SELECT COUNT(*) AS cnt FROM parking_sessions
         WHERE valet_staff_id = $1 AND status = 'active'`,
        [user.id]
      );
      const activeSessions = parseInt(sessionCheck.rows[0].cnt, 10);
      if (activeSessions > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `You have ${activeSessions} active parking session(s). Complete or hand them off before ending your shift.` },
          { status: 409 }
        );
      }
    }

    // Block washers if they have in-progress wash tasks
    if (user.role === 'washer') {
      const washCheck = await client.query(
        `SELECT COUNT(*) AS cnt FROM service_requests
         WHERE assigned_to = $1 AND service_status = 'in_progress'`,
        [user.id]
      );
      const activeTasks = parseInt(washCheck.rows[0].cnt, 10);
      if (activeTasks > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: `You have ${activeTasks} wash task(s) in progress. Complete them before ending your shift.` },
          { status: 409 }
        );
      }
    }

    // Auto-end break if on_break
    let finalBreakMinutes = shift.total_break_minutes;
    if (shift.status === 'on_break' && shift.break_start) {
      const elapsedMs = Date.now() - new Date(shift.break_start).getTime();
      const elapsedMinutes = Math.ceil(elapsedMs / 60000);
      const remaining = shift.max_break_minutes - shift.total_break_minutes;
      finalBreakMinutes += Math.min(elapsedMinutes, remaining);
    }

    const endResult = await client.query(
      `UPDATE staff_shifts
       SET shift_end = NOW(),
           status = 'completed',
           total_break_minutes = $1,
           break_start = NULL,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, shift_start, shift_end, total_break_minutes`,
      [finalBreakMinutes, shift.id]
    );
    await client.query('COMMIT');

    const row = endResult.rows[0];
    const totalMs = new Date(row.shift_end).getTime() - new Date(row.shift_start).getTime();
    const totalMinutes = Math.floor(totalMs / 60000);
    const netMinutes = totalMinutes - row.total_break_minutes;

    return NextResponse.json({
      summary: {
        shift_start: row.shift_start,
        shift_end: row.shift_end,
        total_minutes: totalMinutes,
        total_break_minutes: row.total_break_minutes,
        net_minutes: netMinutes,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('shift/end error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
