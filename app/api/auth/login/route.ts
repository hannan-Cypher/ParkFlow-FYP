import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {

  verifyPassword,
  generateToken,
  getTokenExpiration,
  detectIdentifierType,
  normalizePhone,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Accept both { identifier, password } (new) and { email, password } (backward compat)
    const identifier: string = (body.identifier || body.email || '').trim();
    const { password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Phone/email and password are required' },
        { status: 400 }
      );
    }

    const idType = detectIdentifierType(identifier);

    let userResult;

    if (idType === 'email') {
      userResult = await pool.query(
        'SELECT id, email, phone, password, full_name, role, is_active FROM users WHERE email = $1',
        [identifier.toLowerCase()]
      );
    } else if (idType === 'phone') {
      // Try all common normalizations so format mismatches don't block login
      const normalized = normalizePhone(identifier);
      // Build variants: normalized (0300...), international (9230...), raw
      const stripped = identifier.replace(/[\s\-\+\(\)]/g, '');
      const variants = Array.from(new Set([normalized, stripped, identifier]));

      for (const variant of variants) {
        userResult = await pool.query(
          'SELECT id, email, phone, password, full_name, role, is_active FROM users WHERE phone = $1',
          [variant]
        );
        if (userResult.rows.length > 0) break;
      }
    } else {
      return NextResponse.json(
        { error: 'Please enter a valid email address or phone number' },
        { status: 400 }
      );
    }

    if (!userResult || userResult.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = userResult.rows[0];

    if (user.is_active === false) {
      return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Clear any existing sessions for this user before creating a new one
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

    // Create new session
    const token = generateToken();
    const expiresAt = getTokenExpiration();
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const response = NextResponse.json(
      {
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          fullName: user.full_name,
          role: user.role,
        },
      },
      { status: 200 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
