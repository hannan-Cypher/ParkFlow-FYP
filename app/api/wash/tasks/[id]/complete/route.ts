import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

export const dynamic = 'force-dynamic';


/**
 * POST /api/wash/tasks/[id]/complete
 *
 * Complete a wash task (washer only).
 * Body: { notes?, after_photos? }
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
    const body = await request.json().catch(() => ({}));
    const { notes, after_photos } = body;

    // Verify task exists, is assigned to this washer, and is in_progress
    const taskRes = await pool.query(
      `SELECT id, assigned_to, service_status, customer_id, session_id FROM service_requests
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
    if (task.service_status !== 'in_progress') {
      return NextResponse.json({ error: `Task is ${task.service_status}, not in progress` }, { status: 409 });
    }

    const result = await pool.query(
      `UPDATE service_requests
       SET service_status = 'completed',
           completed_at = NOW(),
           notes = COALESCE($2, notes),
           after_photos = COALESCE($3, after_photos),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, service_status, started_at, completed_at, notes`,
      [id, notes || null, after_photos ? JSON.stringify(after_photos) : null]
    );

    // Notify the customer if exists
    if (task.customer_id) {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, type, related_session_id)
         VALUES ($1, 'Car Wash Complete', 'Your vehicle wash has been completed!', 'wash_complete', $2)`,
        [task.customer_id, task.session_id]
      );
    }

    return NextResponse.json({ task: result.rows[0] });
  } catch (err) {
    console.error('POST /api/wash/tasks/[id]/complete error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
