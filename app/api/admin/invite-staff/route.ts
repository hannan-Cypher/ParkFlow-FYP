import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


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
    const { email, name, phone, venue_id, staff_role: requestedRole } = await request.json();
    const staffRole = ['driver', 'washer', 'supervisor'].includes(requestedRole) ? requestedRole : 'driver';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: 'WhatsApp phone number is required' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Normalize phone formatting locally since lib/auth requires import
    const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');

    // 3. Check if email already exists in users table
    const existingUser = await pool.query(
      `SELECT id, role, status FROM users WHERE email = $1`,
      [cleanEmail]
    );

    let existingUserRow: { id: string; role: string; status: string } | null = null;

    if (existingUser.rows.length > 0) {
      const u = existingUser.rows[0];
      existingUserRow = u;

      if (['driver', 'washer', 'supervisor'].includes(u.role) && u.status === 'active') {
        return NextResponse.json(
          { error: 'This email is already registered as active staff' },
          { status: 409 }
        );
      }
      if (!['driver', 'washer', 'supervisor'].includes(u.role)) {
        return NextResponse.json(
          { error: 'This email is registered with a different role' },
          { status: 409 }
        );
      }
      // staff + deactivated or pending → allow, continue
    }

    // Check phone uniqueness against other active users
    const existingPhone = await pool.query(
      `SELECT email FROM users WHERE phone = $1 OR phone = $2 LIMIT 1`,
      [cleanPhone, phone]
    );
    if (existingPhone.rows.length > 0 && existingPhone.rows[0].email !== cleanEmail) {
      return NextResponse.json({ error: 'This phone number is already registered to another user' }, { status: 409 });
    }

    // 4. Validate venue_id if provided
    if (venue_id) {
      const venueResult = await pool.query(`SELECT id FROM venues WHERE id = $1`, [venue_id]);
      if (venueResult.rows.length === 0) {
        return NextResponse.json({ error: 'Invalid venue' }, { status: 400 });
      }
    }

    // 5. Generate secure token
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // 6. Invalidate previous unused invitations for this email
    await pool.query(
      `UPDATE staff_invitations SET used_at = NOW() WHERE email = $1 AND used_at IS NULL`,
      [cleanEmail]
    );

    // 7. Insert the invitation
    const inviteResult = await pool.query(
      `INSERT INTO staff_invitations (email, name, token, venue_id, invited_by, expires_at, staff_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [cleanEmail, name || null, token, venue_id || null, adminId, expiresAt, staffRole]
    );

    // 8. Pre-create or update user
    if (!existingUserRow) {
      const defaultPassword = crypto.randomBytes(16).toString('hex'); // Fills the NOT NULL password requirement until user registers securely
      const defaultName = name || 'Pending Invite';

      await pool.query(
        `INSERT INTO users (email, full_name, role, status, phone, password) VALUES ($1, $2, $3, 'pending', $4, $5)`,
        [cleanEmail, defaultName, staffRole, cleanPhone, defaultPassword]
      );
    } else if (existingUserRow.status === 'deactivated') {
      await pool.query(`UPDATE users SET status = 'pending', phone = COALESCE(NULLIF(phone, ''), $2) WHERE email = $1`, [cleanEmail, cleanPhone]);
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
