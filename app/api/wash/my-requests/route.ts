import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

export const dynamic = 'force-dynamic';

/**
 * GET /api/wash/my-requests
 *
 * Customer-facing endpoint to list their wash service requests.
 * Optional query param: ?session_id=uuid (filter to one session)
 */
export async function GET(request: NextRequest) {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'customer') {
        return NextResponse.json({ error: 'Forbidden — customers only' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        let query = `
      SELECT
        sr.id,
        sr.session_id,
        sr.wash_type,
        sr.service_status,
        sr.service_cost,
        sr.notes,
        u.full_name AS assigned_to_name,
        sr.started_at,
        sr.completed_at,
        COALESCE(sr.after_photos, '[]'::jsonb) AS after_photos,
        sr.created_at
      FROM service_requests sr
      LEFT JOIN users u ON u.id = sr.assigned_to
      WHERE sr.customer_id = $1
        AND sr.service_type = 'wash'
    `;

        const params: (string)[] = [user.id];

        if (sessionId) {
            query += ` AND sr.session_id = $2`;
            params.push(sessionId);
        }

        query += ` ORDER BY sr.created_at DESC LIMIT 20`;

        const result = await pool.query(query, params);

        const requests = result.rows.map((row) => ({
            id: row.id,
            session_id: row.session_id,
            wash_type: row.wash_type,
            service_status: row.service_status,
            service_cost: row.service_cost,
            notes: row.notes,
            assigned_to_name: row.assigned_to_name,
            started_at: row.started_at,
            completed_at: row.completed_at,
            after_photos: typeof row.after_photos === 'string'
                ? JSON.parse(row.after_photos)
                : (row.after_photos || []),
            created_at: row.created_at,
        }));

        return NextResponse.json({ requests });
    } catch (err) {
        console.error('GET /api/wash/my-requests error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
