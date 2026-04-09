import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateDynamicRate } from '@/lib/pricingEngine';

export const dynamic = 'force-dynamic';


/**
 * GET /api/venues/[id]/current-rate
 * Returns the live dynamic rate for a venue along with occupancy info.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(_request.url);
    const requestedClass = (searchParams.get('class') === 'vip' ? 'vip' : 'standard') as 'standard' | 'vip';

    // Verify venue exists
    const venueCheck = await pool.query(
      'SELECT id, name, total_slots FROM venues WHERE id = $1',
      [id]
    );
    if (venueCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    // Count active sessions of requested class for display
    const occupiedResult = await pool.query(
      `SELECT COUNT(*) AS occupied FROM parking_sessions
       WHERE venue_id = $1 AND status = 'active' AND requested_class = $2`,
      [id, requestedClass]
    );
    const occupied = Number(occupiedResult.rows[0].occupied);

    // Get total slots of class
    const totalSlotsResult = await pool.query(
      `SELECT COUNT(*) AS total FROM parking_slots
       WHERE venue_id = $1 AND slot_type = $2 AND status != 'maintenance'`,
      [id, requestedClass]
    );
    const totalSlots = Number(totalSlotsResult.rows[0].total);

    const metadata = await calculateDynamicRate(id, requestedClass);

    return NextResponse.json({
      venue_id: id,
      venue_name: venueCheck.rows[0].name,
      requested_class: requestedClass,
      rate: metadata.applied_rate,
      base_rate: metadata.base_rate,
      occupancy_percent: metadata.occupancy_percent,
      occupied_slots: occupied,
      total_slots: totalSlots,
      multiplier_used: metadata.occupancy_multiplier_used,
      peak_surcharge_applied: metadata.peak_surcharge_applied,
      is_peak_hour: metadata.is_peak_hour,
      peak_label: metadata.peak_label,
      is_dynamic_enabled: metadata.is_dynamic_enabled,
    });
  } catch (error) {
    console.error('GET current-rate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
