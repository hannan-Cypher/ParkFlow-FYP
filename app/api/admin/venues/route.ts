import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isAdminLike } from '@/lib/roles';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
  try {
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
    if (authResult.rows.length === 0 || !isAdminLike(authResult.rows[0].role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await pool.query(`SELECT id, name FROM venues ORDER BY name ASC`);
    return NextResponse.json({ venues: result.rows });
  } catch (error) {
    console.error('GET /api/admin/venues error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
