import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';
import { isAdminLike } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/customers/search?q=searchterm
 *
 * Search customers by name, email, phone, or license plate.
 * Auth: admin or supervisor only.
 */
export async function GET(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAdminLike(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const q = (searchParams.get('q') || '').trim();

        if (!q) {
            return NextResponse.json({ customers: [] });
        }

        const searchTerm = `%${q}%`;

        const result = await pool.query(
            `SELECT DISTINCT ON (u.id)
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.created_at,
        u.is_active,
        (SELECT COUNT(*) FROM vehicles v WHERE v.owner_id = u.id) AS vehicle_count,
        (SELECT COUNT(*) FROM parking_sessions ps WHERE ps.customer_id = u.id) AS total_sessions,
        (SELECT COUNT(*) FROM parking_sessions ps WHERE ps.customer_id = u.id AND ps.status = 'active') AS active_sessions,
        (SELECT MAX(ps.entry_time) FROM parking_sessions ps WHERE ps.customer_id = u.id) AS last_visit
       FROM users u
       LEFT JOIN vehicles v ON v.owner_id = u.id
       WHERE u.role = 'customer'
         AND (
           u.full_name ILIKE $1
           OR u.email ILIKE $1
           OR u.phone ILIKE $1
           OR v.license_plate ILIKE $1
         )
       ORDER BY u.id, u.created_at DESC
       LIMIT 50`,
            [searchTerm]
        );

        const customers = result.rows.map((row) => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            created_at: row.created_at,
            is_active: row.is_active,
            vehicle_count: Number(row.vehicle_count),
            total_sessions: Number(row.total_sessions),
            active_sessions: Number(row.active_sessions),
            last_visit: row.last_visit ?? null,
        }));

        return NextResponse.json({ customers });
    } catch (err) {
        console.error('GET /api/admin/customers/search error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
