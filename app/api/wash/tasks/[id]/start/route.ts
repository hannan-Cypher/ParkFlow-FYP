import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

export const dynamic = 'force-dynamic';


/**
 * POST /api/wash/tasks/[id]/start
 *
 * Start a wash task (washer only, must be assigned).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'washer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id } = await params;

    // Verify task exists, is assigned to this washer, and is pending
    const taskRes = await pool.query(
      `SELECT id, assigned_to, service_status FROM service_requests
       WHERE id = $1 AND service_type = 'wash'`,
      [id]
    );
    if (taskRes.rows.length === 0) {
      return NextResponse.json({ error: 'Wash task not found' }, { status: 404 });
    }

    const task = taskRes.rows[0];
    if (task.assigned_to !== user.id) {
      return NextResponse.json({ error: 'This task is not assigned to you' }, { status: 403 });
    }
    if (task.service_status !== 'pending') {
      return NextResponse.json({ error: `Task is already ${task.service_status}` }, { status: 409 });
    }

    const result = await pool.query(
      `UPDATE service_requests
       SET service_status = 'in_progress', started_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, service_status, started_at`,
      [id]
    );

    return NextResponse.json({ task: result.rows[0] });
  } catch (err) {
    console.error('POST /api/wash/tasks/[id]/start error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
