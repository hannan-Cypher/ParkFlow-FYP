import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {

  hashPassword,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  normalizePhone,
  generateToken,
  getTokenExpiration,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      phone,
      full_name,
      fullName: fullNameAlt, // backward compat with old callers
      password,
      email,
      session_id,
    } = body;

    const resolvedName: string = (full_name || fullNameAlt || '').trim();

    // ── Determine flow: phone-primary or legacy email-primary ─────────────────
    const hasPhone = !!phone && phone.trim() !== '';
    const hasEmail = !!email && email.trim() !== '';

    if (!hasPhone && !hasEmail) {
      return NextResponse.json(
        { error: 'Phone number or email is required' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (!resolvedName || resolvedName.length < 2) {
      return NextResponse.json(
        { error: 'Name is required (min 2 characters)' },
        { status: 400 }
      );
    }

    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.message }, { status: 400 });
    }

    // ── Phone validation & uniqueness check ───────────────────────────────────
    let normalizedPhone: string | null = null;
    if (hasPhone) {
      if (!isValidPhone(phone.trim())) {
        return NextResponse.json(
          { error: 'Invalid phone number. Enter a valid Pakistani mobile number (e.g. 03001234567)' },
          { status: 400 }
        );
      }
      normalizedPhone = normalizePhone(phone.trim());

      const phoneCheck = await pool.query(
        'SELECT id FROM users WHERE phone = $1',
        [normalizedPhone]
      );
      if (phoneCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'An account with this phone number already exists. Please log in.' },
          { status: 409 }
        );
      }
    }

    // ── Email validation & uniqueness check ───────────────────────────────────
    let normalizedEmail: string | null = null;
    if (hasEmail) {
      if (!isValidEmail(email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
      normalizedEmail = email.trim().toLowerCase();

      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [normalizedEmail]
      );
      if (emailCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }
    }

    // ── Hash password & insert user ───────────────────────────────────────────
    const hashedPassword = await hashPassword(password);

    const insertResult = await pool.query(
      `INSERT INTO users (phone, full_name, password, email, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'customer', true, NOW(), NOW())
       RETURNING id, phone, full_name, email, role`,
      [normalizedPhone, resolvedName, hashedPassword, normalizedEmail]
    );
    const user = insertResult.rows[0];

    // ── Link parking session if session_id provided ───────────────────────────
    if (session_id) {
      const sessionRow = await pool.query(
        'SELECT id, vehicle_id, customer_id FROM parking_sessions WHERE id = $1',
        [session_id]
      );
      if (sessionRow.rows.length > 0 && sessionRow.rows[0].customer_id === null) {
        const ps = sessionRow.rows[0];
        await pool.query(
          'UPDATE parking_sessions SET customer_id = $1 WHERE id = $2',
          [user.id, session_id]
        );
        if (ps.vehicle_id) {
          await pool.query(
            'UPDATE vehicles SET owner_id = $1 WHERE id = $2 AND owner_id IS NULL',
            [user.id, ps.vehicle_id]
          );
        }
      }
    }

    // ── Create auth session (auto-login) ──────────────────────────────────────
    const token = generateToken();
    const expiresAt = getTokenExpiration();
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const response = NextResponse.json(
      {
        success: true,
        message: 'Account created successfully',
        user: {
          id: user.id,
          phone: user.phone,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === 'https:',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', detail: error.message },
      { status: 500 }
    );
  }
}
