import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateDynamicRate } from '@/lib/pricingEngine';

/**
 * GET /api/venues/[id]/current-rate
 * Returns the live dynamic rate for a venue along with occupancy info.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Verify venue exists
    const venueCheck = await pool.query(
      'SELECT id, name, total_slots FROM venues WHERE id = $1',
      [id]
    );
    if (venueCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    // Count active sessions for display
    const occupiedResult = await pool.query(
      `SELECT COUNT(*) AS occupied FROM parking_sessions
       WHERE venue_id = $1 AND status = 'active'`,
      [id]
    );
    const occupied = Number(occupiedResult.rows[0].occupied);
    const totalSlots = Number(venueCheck.rows[0].total_slots);

    const metadata = await calculateDynamicRate(id);

    return NextResponse.json({
      venue_id: id,
      venue_name: venueCheck.rows[0].name,
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
