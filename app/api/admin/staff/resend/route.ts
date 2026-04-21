import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


export async function POST(request: NextRequest) {
  try {
    // Authenticate admin
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authResult = await pool.query(
      `SELECT u.id, u.role FROM users u
       INNER JOIN sessions s ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [authToken]
    );
    if (authResult.rows.length === 0 || (authResult.rows[0].role !== 'admin' && authResult.rows[0].role !== 'supervisor')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminId = authResult.rows[0].id;

    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Verify user is pending staff
    const userResult = await pool.query(
      `SELECT id, role, status, full_name FROM users WHERE email = $1`,
      [cleanEmail]
    );
    if (
      userResult.rows.length === 0 ||
      !['driver', 'washer', 'supervisor'].includes(userResult.rows[0].role) ||
      userResult.rows[0].status !== 'pending'
    ) {
      return NextResponse.json(
        { error: 'No pending staff member found with that email' },
        { status: 400 }
      );
    }

    const staffUser = userResult.rows[0];

    // Get venue from last invitation
    const lastInvite = await pool.query(
      `SELECT venue_id, name FROM staff_invitations WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail]
    );
    const venueId = lastInvite.rows[0]?.venue_id || null;
    const staffName = lastInvite.rows[0]?.name || staffUser.full_name || null;

    // Generate new token, invalidate old invitations
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await pool.query(
      `UPDATE staff_invitations SET used_at = NOW() WHERE email = $1 AND used_at IS NULL`,
      [cleanEmail]
    );

    await pool.query(
      `INSERT INTO staff_invitations (email, name, token, venue_id, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cleanEmail, staffName, token, venueId, adminId, expiresAt]
    );

    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-staff?token=${token}`;

    return NextResponse.json({
      message: 'New invitation created',
      magicLink,
      name: staffName,
    });
  } catch (error) {
    console.error('resend invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
