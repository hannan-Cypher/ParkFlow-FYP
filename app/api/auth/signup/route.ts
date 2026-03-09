import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { hashPassword, isValidEmail, isValidPassword, generateToken, getTokenExpiration } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting signup process...');
    const body = await request.json();
    const { email, password, fullName, phone } = body;
    
    console.log('Received signup data:', { email, fullName, phone, hasPassword: !!password });

    // Validation
    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'Email, password, and full name are required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone number format if provided
    if (phone && phone.length > 20) {
      return NextResponse.json(
        { error: 'Phone number is too long. Maximum 20 characters allowed.' },
        { status: 400 }
      );
    }

    // Basic phone number format validation
    if (phone && !/^[+\d\s()-]+$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use only numbers, spaces, and characters: + - ( )' },
        { status: 400 }
      );
    }

    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 }
      );
    }

    console.log('Checking for existing user...');
    // Check if user already exists
    try {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      console.log('Existing user query result:', existingUser.rows);

      if (existingUser.rows.length > 0) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        );
      }
    } catch (dbError: any) {
      console.error('Database error checking existing user:', dbError);
      return NextResponse.json(
        { 
          error: 'Database error while checking existing user',
          detail: dbError.message,
          code: dbError.code
        },
        { status: 500 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    console.log('Inserting new user...');
    // Insert user
    let result: any;
    try {
      result = await pool.query(
        `INSERT INTO users (email, password, full_name, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, full_name, phone`,
        [email.toLowerCase(), hashedPassword, fullName, phone]
      );

      console.log('User inserted successfully:', result.rows[0]);
    } catch (dbError: any) {
      console.error('Database error inserting user:', dbError);
      return NextResponse.json(
        { 
          error: 'Database error while creating user',
          detail: dbError.message,
          code: dbError.code
        },
        { status: 500 }
      );
    }

    const user = result.rows[0];

    // Create session token
    const token = generateToken();
    const expiresAt = getTokenExpiration();

    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Set cookie
    const response = NextResponse.json(
      {
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
        },
      },
      { status: 201 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
    } catch (error: any) {
    console.error('Unexpected error in signup:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        detail: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
