import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { generateToken, getTokenExpiration } from '@/lib/auth';

/**
 * POST /api/auth/magic
 *
 * Verify a magic link token and auto-login the customer.
 * Tokens are one-time use with a 24-hour TTL.
 *
 * Body: { token: string, session_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, session_id } = body;

    if (!token || !session_id) {
      return NextResponse.json(
        { error: 'token and session_id are required' },
        { status: 400 }
      );
    }

    // Look up the magic link + user in one query
    const result = await pool.query(
      `SELECT ml.id, ml.user_id, ml.expires_at, ml.used_at,
              u.id AS uid, u.full_name, u.phone, u.email, u.role, u.is_active
       FROM magic_links ml
       JOIN users u ON ml.user_id = u.id
       WHERE ml.token = $1 AND ml.session_id = $2`,
      [token, session_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or expired link' },
        { status: 401 }
      );
    }

    const ml = result.rows[0];

    if (ml.used_at !== null) {
      return NextResponse.json(
        { error: 'This link has already been used. Please log in normally.' },
        { status: 401 }
      );
    }

    if (new Date(ml.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This link has expired. Please log in normally.' },
        { status: 401 }
      );
    }

    if (ml.is_active === false) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    // Mark token as used (one-time use)
    await pool.query(
      'UPDATE magic_links SET used_at = NOW() WHERE id = $1',
      [ml.id]
    );

    // Create auth session (same as normal login)
    const authToken = generateToken();
    const expiresAt = getTokenExpiration();
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [ml.user_id, authToken, expiresAt]
    );

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: ml.uid,
          full_name: ml.full_name,
          phone: ml.phone,
          email: ml.email,
          role: ml.role,
        },
        redirect: '/customer',
      },
      { status: 200 }
    );

    response.cookies.set('auth_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
