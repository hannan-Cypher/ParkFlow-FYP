import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const shiftRes = await pool.query(
      `SELECT ss.*, v.max_break_minutes
       FROM staff_shifts ss JOIN venues v ON v.id = ss.venue_id
       WHERE ss.staff_id = $1 AND ss.status = 'on_break'
       ORDER BY ss.created_at DESC LIMIT 1`,
      [user.id]
    );
    if (shiftRes.rows.length === 0) {
      return NextResponse.json({ error: 'Not currently on break' }, { status: 409 });
    }
    const shift = shiftRes.rows[0];

    // Calculate elapsed minutes, cap at remaining allowance
    const elapsedMs = Date.now() - new Date(shift.break_start).getTime();
    const elapsedMinutes = Math.ceil(elapsedMs / 60000);
    const remaining = shift.max_break_minutes - shift.total_break_minutes;
    const toAdd = Math.min(elapsedMinutes, remaining);
    const newTotal = shift.total_break_minutes + toAdd;

    await pool.query(
      `UPDATE staff_shifts
       SET status = 'active',
           total_break_minutes = $1,
           break_start = NULL,
           updated_at = NOW()
       WHERE id = $2`,
      [newTotal, shift.id]
    );

    // Also set user as active so they can be assigned tasks again
    await pool.query(
      `UPDATE users SET is_active = true, updated_at = NOW() WHERE id = $1`,
      [user.id]
    );

    const updated = await pool.query(
      `SELECT id, shift_start, status, break_start, total_break_minutes 
       FROM staff_shifts WHERE id = $1`,
      [shift.id]
    );


    return NextResponse.json({ shift: updated.rows[0], minutesUsed: toAdd });
  } catch (err) {
    console.error('break/end error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
