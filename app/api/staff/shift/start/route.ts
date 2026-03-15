import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { isStaffRole, isAdminLike } from '@/lib/roles';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isStaffRole(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (!user.venue_id) {
    return NextResponse.json({ error: 'You are not assigned to a venue' }, { status: 400 });
  }

  try {
    // Guard: reject if active shift already exists
    const existing = await pool.query(
      `SELECT id FROM staff_shifts WHERE staff_id = $1 AND status IN ('active', 'on_break') LIMIT 1`,
      [user.id]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'You already have an active shift' }, { status: 409 });
    }

    // Fetch venue shift config
    const venueRes = await pool.query(
      `SELECT shift_start_time::text, enforce_shift_start_window FROM venues WHERE id = $1`,
      [user.venue_id]
    );
    if (venueRes.rows.length === 0) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }
    const { shift_start_time, enforce_shift_start_window } = venueRes.rows[0];

    // Check if staff is late (past the 1-hour start window)
    let isLate = false;
    let lateMinutes = 0;

    if (enforce_shift_start_window && shift_start_time) {
      const [shiftH, shiftM] = (shift_start_time as string).split(':').map(Number);
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const shiftStartMinutes = shiftH * 60 + shiftM;
      const deadlineMinutes = shiftStartMinutes + 60;

      if (nowMinutes > deadlineMinutes) {
        isLate = true;
        lateMinutes = nowMinutes - shiftStartMinutes;
      }
    }

    // Also guard against pending_approval shift already existing
    const pendingExisting = await pool.query(
      `SELECT id FROM staff_shifts WHERE staff_id = $1 AND status IN ('pending_approval') LIMIT 1`,
      [user.id]
    );
    if (pendingExisting.rows.length > 0) {
      return NextResponse.json(
        { error: 'Your shift is already awaiting admin approval', code: 'PENDING_APPROVAL' },
        { status: 409 }
      );
    }

    const shiftStatus = isLate ? 'pending_approval' : 'active';
    const result = await pool.query(
      `INSERT INTO staff_shifts (staff_id, venue_id, status, is_late, late_minutes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, shift_start, status, break_start, total_break_minutes, is_late, late_minutes`,
      [user.id, user.venue_id, shiftStatus, isLate, lateMinutes]
    );

    // If late, notify all admins
    if (isLate) {
      const venueNameRes = await pool.query(`SELECT name FROM venues WHERE id = $1`, [user.venue_id]);
      const venueName = venueNameRes.rows[0]?.name ?? 'the venue';
      const admins = await pool.query(`SELECT id FROM users WHERE role IN ('admin', 'supervisor')`);
      const title = `Late Arrival: ${user.full_name}`;
      const message = `${user.full_name} clocked in ${lateMinutes} min late at ${venueName}. Awaiting your approval.`;
      for (const admin of admins.rows as { id: string }[]) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, 'late_arrival')`,
          [admin.id, title, message]
        );
      }
    }

    return NextResponse.json(
      { shift: result.rows[0], code: isLate ? 'PENDING_APPROVAL' : 'OK' },
      { status: 201 }
    );
  } catch (err) {
    console.error('shift/start error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
