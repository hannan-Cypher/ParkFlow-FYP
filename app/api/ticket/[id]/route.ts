import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * GET /api/ticket/[id]
 *
 * Public endpoint — no auth required.
 * Returns limited session data for the QR scan landing page.
 * Does NOT expose: customer phone, staff info, pricing metadata.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await pool.query(
      `SELECT
        ps.id, ps.entry_time, ps.exit_time, ps.status, ps.qr_code,
        ps.rate_per_hour, ps.total_hours, ps.total_amount,
        ps.retrieval_status,
        v.license_plate, v.make, v.model, v.color,
        ven.name AS venue_name, ven.address AS venue_address,
        pk.slot_number, pk.floor_level, pk.zone
      FROM parking_sessions ps
      LEFT JOIN vehicles v ON ps.vehicle_id = v.id
      LEFT JOIN venues ven ON ps.venue_id = ven.id
      LEFT JOIN parking_slots pk ON ps.slot_id = pk.id
      WHERE ps.id = $1`,
      [params.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session: result.rows[0] });
  } catch (error) {
    console.error('Ticket API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
