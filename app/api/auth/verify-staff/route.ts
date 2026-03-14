import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

// GET — validate token, return invitation info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const result = await pool.query(
      `SELECT si.*, v.name as venue_name
       FROM staff_invitations si
       LEFT JOIN venues v ON si.venue_id = v.id
       WHERE si.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invalid invitation link' }, { status: 400 });
    }

    const invitation = result.rows[0];

    if (invitation.used_at !== null) {
      return NextResponse.json(
        { valid: false, error: 'This invitation has already been used. Try logging in instead.' },
        { status: 400 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'This invitation has expired. Please contact your admin for a new one.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      name: invitation.name,
      venue_name: invitation.venue_name,
    });
  } catch (error) {
    console.error('verify-staff GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST — complete profile, activate account, create session
export async function POST(request: NextRequest) {
  try {
    const { token, full_name, phone, password } = await request.json();

    if (!token || !full_name || !phone || !password) {
      return NextResponse.json(
        { error: 'All fields are required: full_name, phone, password' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (!phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Look up token
    const inviteResult = await pool.query(
      `SELECT * FROM staff_invitations WHERE token = $1`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 400 });
    }

    const invitation = inviteResult.rows[0];

    if (invitation.used_at !== null) {
      return NextResponse.json(
        { error: 'This invitation has already been used. Try logging in instead.' },
        { status: 400 }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired. Please contact your admin for a new one.' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    // Check if user already exists (pre-created as pending)
    const existingUser = await pool.query(
      `SELECT id, status FROM users WHERE email = $1`,
      [invitation.email]
    );

    let user: { id: string; email: string; full_name: string; phone: string; role: string };

    if (existingUser.rows.length > 0) {
      // Update the pre-created pending user
      const updateResult = await pool.query(
        `UPDATE users
         SET full_name = $1, phone = $2, password = $3, status = 'active', updated_at = NOW()
         WHERE email = $4
         RETURNING id, email, full_name, phone, role`,
        [full_name.trim(), phone.trim(), hashedPassword, invitation.email]
      );
      user = updateResult.rows[0];
    } else {
      // Edge case — pre-created user was deleted, insert fresh
      const insertResult = await pool.query(
        `INSERT INTO users (email, full_name, phone, password, role, status)
         VALUES ($1, $2, $3, $4, 'valet_staff', 'active')
         RETURNING id, email, full_name, phone, role`,
        [invitation.email, full_name.trim(), phone.trim(), hashedPassword]
      );
      user = insertResult.rows[0];
    }

    // Mark invitation as used
    await pool.query(
      `UPDATE staff_invitations SET used_at = NOW() WHERE token = $1`,
      [token]
    );

    // Create session (same pattern as login route)
    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, sessionToken, expiresAt]
    );

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    });

    response.cookies.set('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('verify-staff POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
