import { NextRequest } from 'next/server';
import pool from '@/lib/db';

export interface AuthUser {
    id: string;
    email: string | null;
    full_name: string;
    phone: string;
    role: 'admin' | 'valet_staff' | 'customer';
    venue_id: string | null;
}

/**
 * Extract the authenticated user from the request cookie.
 * Returns null if no valid session exists.
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;

    const result = await pool.query(
        `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.venue_id
     FROM users u
     INNER JOIN sessions s ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
        [token]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0] as AuthUser;
}
