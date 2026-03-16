import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isAdminLike, isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';


async function getAdminLikeUser(request: NextRequest): Promise<{ id: string; role: string } | null> {
  const authToken = request.cookies.get('auth_token')?.value;
  if (!authToken) return null;

  const result = await pool.query(
    `SELECT u.id, u.role FROM users u
     INNER JOIN sessions s ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [authToken]
  );

  if (result.rows.length === 0 || !isAdminLike(result.rows[0].role)) return null;
  return result.rows[0];
}

// GET — list all staff members
export async function GET(request: NextRequest) {
  try {
    const adminUser = await getAdminLikeUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(`
      SELECT
        u.id, u.email, u.full_name, u.phone, u.role, u.status, u.created_at,
        u.venue_id, av.name as venue_name,
        u.zone_id, az.name as zone_name,
        si.created_at as invited_at,
        inviter.full_name as invited_by_name,
        CASE WHEN ss.id IS NOT NULL THEN true ELSE false END AS on_duty
      FROM users u
      LEFT JOIN venues av ON u.venue_id = av.id
      LEFT JOIN zones az ON u.zone_id = az.id
      LEFT JOIN (
        SELECT DISTINCT ON (email) email, invited_by, created_at
        FROM staff_invitations
        ORDER BY email, created_at DESC
      ) si ON u.email = si.email
      LEFT JOIN users inviter ON si.invited_by = inviter.id
      LEFT JOIN LATERAL (
        SELECT id FROM staff_shifts
        WHERE staff_id = u.id AND status IN ('active', 'on_break')
        LIMIT 1
      ) ss ON true
      WHERE u.role IN ('driver', 'washer', 'supervisor')
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({ staff: result.rows });
  } catch (error) {
    console.error('GET /api/admin/staff error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — deactivate a staff member (admin only, supervisors cannot deactivate)
export async function DELETE(request: NextRequest) {
  try {
    const adminUser = await getAdminLikeUser(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can deactivate staff' }, { status: 403 });
    }

    const { staff_id } = await request.json();
    if (!staff_id) {
      return NextResponse.json({ error: 'staff_id is required' }, { status: 400 });
    }

    const userResult = await pool.query(`SELECT id, role FROM users WHERE id = $1`, [staff_id]);
    if (userResult.rows.length === 0 || !isStaffRole(userResult.rows[0].role)) {
      return NextResponse.json({ error: 'Can only deactivate staff members' }, { status: 400 });
    }

    await pool.query(
      `UPDATE users SET status = 'deactivated', updated_at = NOW() WHERE id = $1`,
      [staff_id]
    );
    await pool.query(`DELETE FROM sessions WHERE user_id = $1`, [staff_id]);

    return NextResponse.json({ message: 'Staff member deactivated' });
  } catch (error) {
    console.error('DELETE /api/admin/staff error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
