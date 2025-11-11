import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
    }

    // Check if session is valid
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone 
       FROM users u
       INNER JOIN sessions s ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      // Token is invalid or expired
      const response = NextResponse.json(
        { authenticated: false },
        { status: 200 }
      );
      
      // Clear invalid cookie
      response.cookies.set('auth_token', '', {
        httpOnly: true,
        maxAge: 0,
        path: '/',
      });

      return response;
    }

    const user = result.rows[0];

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Internal server error', authenticated: false },
      { status: 500 }
    );
  }
}
