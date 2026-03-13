import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { code } = params;

  try {
    const result = await pool.query(
      `SELECT
        ps.id, ps.vehicle_id, ps.customer_id, ps.venue_id, ps.slot_id,
        ps.valet_staff_id, ps.entry_time, ps.exit_time, ps.status,
        ps.qr_code, ps.rate_per_hour, ps.total_hours, ps.total_amount,
        ps.payment_status, ps.retrieval_status, ps.retrieval_requested_at,
        ps.rating, ps.rating_comment, ps.pricing_metadata,
        ps.customer_notes, ps.staff_notes,
        v.license_plate, v.make, v.model, v.color, v.vehicle_type,
        ven.name AS venue_name, ven.address AS venue_address,
        pk.slot_number, pk.floor_level, pk.zone,
        u.full_name AS customer_name, u.phone AS customer_phone,
        staff.full_name AS staff_name
      FROM parking_sessions ps
      LEFT JOIN vehicles v ON ps.vehicle_id = v.id
      LEFT JOIN venues ven ON ps.venue_id = ven.id
      LEFT JOIN parking_slots pk ON ps.slot_id = pk.id
      LEFT JOIN users u ON ps.customer_id = u.id
      LEFT JOIN users staff ON ps.valet_staff_id = staff.id
      WHERE ps.qr_code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const row = result.rows[0];

    // Customers may only access their own sessions
    if (user.role === 'customer' && row.customer_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Role-based field filtering
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session: Record<string, any> = { ...row };

    if (user.role === 'valet_staff') {
      delete session.pricing_metadata;
      delete session.customer_phone;
    } else if (user.role === 'customer') {
      delete session.staff_notes;
      delete session.pricing_metadata;
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('QR session lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
