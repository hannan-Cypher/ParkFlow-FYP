import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate — admin only
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
    if (authResult.rows.length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminUser = authResult.rows[0];
    if (adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can invite staff' }, { status: 403 });
    }
    const adminId = adminUser.id;

    // 2. Parse and validate input
    const { email, name, venue_id } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    // 3. Check if email already exists in users table
    const existingUser = await pool.query(
      `SELECT id, role, status FROM users WHERE email = $1`,
      [cleanEmail]
    );

    let existingUserRow: { id: string; role: string; status: string } | null = null;

    if (existingUser.rows.length > 0) {
      const u = existingUser.rows[0];
      existingUserRow = u;

      if (u.role === 'valet_staff' && u.status === 'active') {
        return NextResponse.json(
          { error: 'This email is already registered as active staff' },
          { status: 409 }
        );
      }
      if (u.role !== 'valet_staff') {
        return NextResponse.json(
          { error: 'This email is registered with a different role' },
          { status: 409 }
        );
      }
      // valet_staff + deactivated or pending → allow, continue
    }

    // 4. Validate venue_id if provided
    if (venue_id) {
      const venueResult = await pool.query(`SELECT id FROM venues WHERE id = $1`, [venue_id]);
      if (venueResult.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid venue' }, { status: 400 });
      }
    }

    // 5. Generate secure token
    const token = crypto.randomUUID() + '-' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 6. Invalidate previous unused invitations for this email
    await pool.query(
      `UPDATE staff_invitations SET used_at = NOW() WHERE email = $1 AND used_at IS NULL`,
      [cleanEmail]
    );

    // 7. Insert the invitation
    const inviteResult = await pool.query(
      `INSERT INTO staff_invitations (email, name, token, venue_id, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [cleanEmail, name || null, token, venue_id || null, adminId, expiresAt]
    );

    // 8. Pre-create or update user
    if (!existingUserRow) {
      await pool.query(
        `INSERT INTO users (email, full_name, role, status) VALUES ($1, $2, 'valet_staff', 'pending')`,
        [cleanEmail, name || null]
      );
    } else if (existingUserRow.status === 'deactivated') {
      await pool.query(`UPDATE users SET status = 'pending' WHERE email = $1`, [cleanEmail]);
    }
    // status = 'pending' → do nothing

    // 9. Build magic link and return it (admin sends via WhatsApp)
    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-staff?token=${token}`;

    return NextResponse.json({
      message: 'Invitation created successfully',
      magicLink,
      invitation_id: inviteResult.rows[0].id,
    });
  } catch (error) {
    console.error('invite-staff error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
