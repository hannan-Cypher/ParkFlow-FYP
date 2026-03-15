import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

export const dynamic = 'force-dynamic';


/**
 * GET /api/wash/tasks
 *
 * Returns wash tasks for the current washer (or all if admin/supervisor).
 * Query params:
 *   status — 'pending' | 'in_progress' | 'completed' | 'all' (default: 'pending')
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status') || 'pending';

  try {
    let whereConditions = `WHERE sr.service_type = 'wash'`;
    const params: string[] = [];
    let paramIdx = 1;

    // Washer sees only their tasks; admin/supervisor sees all
    if (user.role === 'washer') {
      whereConditions += ` AND sr.assigned_to = $${paramIdx}`;
      params.push(user.id);
      paramIdx++;
    }

    if (statusFilter !== 'all') {
      whereConditions += ` AND sr.service_status = $${paramIdx}`;
      params.push(statusFilter);
      paramIdx++;
    }

    const result = await pool.query(
      `SELECT
        sr.id,
        sr.session_id,
        sr.service_status,
        sr.wash_type,
        sr.service_cost,
        sr.notes,
        sr.before_photos,
        sr.after_photos,
        sr.started_at,
        sr.completed_at,
        sr.created_at,
        v.id AS vehicle_id,
        v.license_plate,
        v.make,
        v.model,
        v.color,
        v.vehicle_type,
        ps.slot_id,
        sl.slot_number,
        sl.floor_level,
        sl.zone,
        ve.id AS venue_id,
        ve.name AS venue_name,
        cu.full_name AS customer_name,
        cu.phone AS customer_phone,
        u_assigned.full_name AS assigned_to_name
      FROM service_requests sr
      LEFT JOIN parking_sessions ps ON ps.id = sr.session_id
      LEFT JOIN vehicles v ON v.id = COALESCE(sr.vehicle_id, ps.vehicle_id)
      LEFT JOIN parking_slots sl ON sl.id = COALESCE(sr.slot_id, ps.slot_id)
      LEFT JOIN venues ve ON ve.id = COALESCE(sr.venue_id, ps.venue_id)
      LEFT JOIN users cu ON cu.id = sr.customer_id
      LEFT JOIN users u_assigned ON u_assigned.id = sr.assigned_to
      ${whereConditions}
      ORDER BY
        CASE sr.service_status
          WHEN 'in_progress' THEN 0
          WHEN 'pending' THEN 1
          WHEN 'completed' THEN 2
          ELSE 3
        END,
        sr.created_at DESC
      LIMIT 100`,
      params
    );

    const tasks = result.rows.map((r) => ({
      id: r.id,
      session_id: r.session_id,
      status: r.service_status,
      wash_type: r.wash_type,
      cost: r.service_cost ? Number(r.service_cost) : null,
      notes: r.notes,
      before_photos: r.before_photos || [],
      after_photos: r.after_photos || [],
      started_at: r.started_at,
      completed_at: r.completed_at,
      created_at: r.created_at,
      assigned_to_name: r.assigned_to_name,
      vehicle: {
        id: r.vehicle_id,
        license_plate: r.license_plate,
        make: r.make,
        model: r.model,
        color: r.color,
        vehicle_type: r.vehicle_type,
      },
      slot: r.slot_number
        ? { slot_number: r.slot_number, floor_level: r.floor_level, zone: r.zone }
        : null,
      venue: { id: r.venue_id, name: r.venue_name },
      customer: { name: r.customer_name, phone: r.customer_phone },
    }));

    return NextResponse.json({ tasks });
  } catch (err) {
    console.error('GET /api/wash/tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
