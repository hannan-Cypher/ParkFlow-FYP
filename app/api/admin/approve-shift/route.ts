import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isAdminLike } from '@/lib/roles';

export const dynamic = 'force-dynamic';


async function getAdminLikeId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.id, u.role FROM users u
     INNER JOIN sessions s ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  if (result.rows.length === 0 || !isAdminLike(result.rows[0].role)) return null;
  return result.rows[0].id;
}

// GET — list all pending_approval shifts
export async function GET(request: NextRequest) {
  try {
    const adminId = await getAdminLikeId(request);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await pool.query(`
      SELECT
        ss.id,
        ss.shift_start,
        ss.late_minutes,
        ss.is_late,
        ss.status,
        u.id        AS staff_id,
        u.full_name,
        u.email,
        u.phone,
        v.id        AS venue_id,
        v.name      AS venue_name
      FROM staff_shifts ss
      JOIN users u ON ss.staff_id = u.id
      JOIN venues v ON ss.venue_id = v.id
      WHERE ss.status = 'pending_approval'
      ORDER BY ss.shift_start ASC
    `);

    return NextResponse.json({ pendingShifts: result.rows });
  } catch (err) {
    console.error('GET /api/admin/approve-shift error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — approve or reject a pending shift
export async function POST(request: NextRequest) {
  try {
    const adminId = await getAdminLikeId(request);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { shift_id, action } = body;

    if (!shift_id) return NextResponse.json({ error: 'shift_id is required' }, { status: 400 });
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    // Verify the shift exists and is pending_approval
    const shiftRes = await pool.query(
      `SELECT ss.id, ss.staff_id, u.full_name FROM staff_shifts ss
       JOIN users u ON ss.staff_id = u.id
       WHERE ss.id = $1 AND ss.status = 'pending_approval'`,
      [shift_id]
    );
    if (shiftRes.rows.length === 0) {
      return NextResponse.json({ error: 'Shift not found or not pending approval' }, { status: 404 });
    }

    const shift = shiftRes.rows[0];
    const newStatus = action === 'approve' ? 'active' : 'rejected';

    await pool.query(
      `UPDATE staff_shifts
       SET status = $1, admin_approval = $2, admin_approval_by = $3, admin_approval_at = NOW(), updated_at = NOW()
       WHERE id = $4`,
      [newStatus, action === 'approve' ? 'approved' : 'rejected', adminId, shift_id]
    );

    // Notify the staff member
    const notifTitle = action === 'approve' ? 'Shift Approved' : 'Shift Rejected';
    const notifMessage = action === 'approve'
      ? "Your late shift has been approved. You're good to go!"
      : 'Your shift has been rejected. Please report to your manager.';
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, 'shift_approval')`,
      [shift.staff_id, notifTitle, notifMessage]
    );

    return NextResponse.json({
      message: `Shift ${action === 'approve' ? 'approved' : 'rejected'} for ${shift.full_name}`,
    });
  } catch (err) {
    console.error('POST /api/admin/approve-shift error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
