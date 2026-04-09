import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * GET /api/venues/[id]/pricing
 * Returns the dynamic pricing configuration for a venue.
 *
 * PUT /api/venues/[id]/pricing
 * Updates the dynamic pricing configuration for a venue.
 * Body fields (all optional):
 *   base_rate_per_hour, high_occupancy_threshold, high_occupancy_multiplier,
 *   critical_occupancy_threshold, critical_occupancy_multiplier,
 *   peak_hours, peak_hour_surcharge, max_rate_per_hour, min_rate_per_hour,
 *   is_dynamic_enabled
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      `SELECT
         id, name,
         base_rate_per_hour,
         high_occupancy_threshold,
         high_occupancy_multiplier,
         critical_occupancy_threshold,
         critical_occupancy_multiplier,
         peak_hours,
         peak_hour_surcharge,
         max_rate_per_hour,
         min_rate_per_hour,
         is_dynamic_enabled,
         vip_base_rate_per_hour,
         vip_high_occupancy_multiplier,
         vip_critical_occupancy_multiplier
       FROM venues WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      venue_id: row.id,
      name: row.name,
      base_rate_per_hour: Number(row.base_rate_per_hour),
      high_occupancy_threshold: row.high_occupancy_threshold,
      high_occupancy_multiplier: Number(row.high_occupancy_multiplier),
      critical_occupancy_threshold: row.critical_occupancy_threshold,
      critical_occupancy_multiplier: Number(row.critical_occupancy_multiplier),
      peak_hours: row.peak_hours,
      peak_hour_surcharge: Number(row.peak_hour_surcharge),
      max_rate_per_hour: Number(row.max_rate_per_hour),
      min_rate_per_hour: Number(row.min_rate_per_hour),
      is_dynamic_enabled: row.is_dynamic_enabled,
      vip_base_rate_per_hour: row.vip_base_rate_per_hour ? Number(row.vip_base_rate_per_hour) : null,
      vip_high_occupancy_multiplier: row.vip_high_occupancy_multiplier ? Number(row.vip_high_occupancy_multiplier) : null,
      vip_critical_occupancy_multiplier: row.vip_critical_occupancy_multiplier ? Number(row.vip_critical_occupancy_multiplier) : null,
    });
  } catch (error) {
    console.error('GET pricing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      base_rate_per_hour,
      high_occupancy_threshold,
      high_occupancy_multiplier,
      critical_occupancy_threshold,
      critical_occupancy_multiplier,
      peak_hours,
      peak_hour_surcharge,
      max_rate_per_hour,
      min_rate_per_hour,
      is_dynamic_enabled,
      vip_base_rate_per_hour,
      vip_high_occupancy_multiplier,
      vip_critical_occupancy_multiplier,
    } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (
      high_occupancy_threshold != null &&
      critical_occupancy_threshold != null &&
      critical_occupancy_threshold <= high_occupancy_threshold
    ) {
      return NextResponse.json(
        { error: 'critical_occupancy_threshold must be greater than high_occupancy_threshold' },
        { status: 400 }
      );
    }

    if (
      min_rate_per_hour != null &&
      max_rate_per_hour != null &&
      min_rate_per_hour >= max_rate_per_hour
    ) {
      return NextResponse.json(
        { error: 'min_rate_per_hour must be less than max_rate_per_hour' },
        { status: 400 }
      );
    }

    if (high_occupancy_multiplier != null && high_occupancy_multiplier < 1.0) {
      return NextResponse.json(
        { error: 'high_occupancy_multiplier must be >= 1.0' },
        { status: 400 }
      );
    }

    if (critical_occupancy_multiplier != null && critical_occupancy_multiplier < 1.0) {
      return NextResponse.json(
        { error: 'critical_occupancy_multiplier must be >= 1.0' },
        { status: 400 }
      );
    }

    // VIP Multiplier Validation
    if (vip_high_occupancy_multiplier != null && vip_high_occupancy_multiplier < 1.0) {
      return NextResponse.json(
        { error: 'vip_high_occupancy_multiplier must be >= 1.0' },
        { status: 400 }
      );
    }
    if (vip_critical_occupancy_multiplier != null && vip_critical_occupancy_multiplier < 1.0) {
      return NextResponse.json(
        { error: 'vip_critical_occupancy_multiplier must be >= 1.0' },
        { status: 400 }
      );
    }

    // ── Fetch existing to fill gaps (so partial updates work) ─────────────
    const existing = await pool.query(
      `SELECT * FROM venues WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
    }
    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE venues SET
         base_rate_per_hour            = $1,
         high_occupancy_threshold      = $2,
         high_occupancy_multiplier     = $3,
         critical_occupancy_threshold  = $4,
         critical_occupancy_multiplier = $5,
         peak_hours                    = $6,
         peak_hour_surcharge           = $7,
         max_rate_per_hour             = $8,
         min_rate_per_hour             = $9,
         is_dynamic_enabled            = $10,
         vip_base_rate_per_hour        = $11,
         vip_high_occupancy_multiplier = $12,
         vip_critical_occupancy_multiplier = $13,
         updated_at                    = NOW()
       WHERE id = $14
       RETURNING
         id, name,
         base_rate_per_hour,
         high_occupancy_threshold,
         high_occupancy_multiplier,
         critical_occupancy_threshold,
         critical_occupancy_multiplier,
         peak_hours,
         peak_hour_surcharge,
         max_rate_per_hour,
         min_rate_per_hour,
         is_dynamic_enabled,
         vip_base_rate_per_hour,
         vip_high_occupancy_multiplier,
         vip_critical_occupancy_multiplier`,
      [
        base_rate_per_hour ?? current.base_rate_per_hour,
        high_occupancy_threshold ?? current.high_occupancy_threshold,
        high_occupancy_multiplier ?? current.high_occupancy_multiplier,
        critical_occupancy_threshold ?? current.critical_occupancy_threshold,
        critical_occupancy_multiplier ?? current.critical_occupancy_multiplier,
        peak_hours != null ? JSON.stringify(peak_hours) : JSON.stringify(current.peak_hours),
        peak_hour_surcharge ?? current.peak_hour_surcharge,
        max_rate_per_hour ?? current.max_rate_per_hour,
        min_rate_per_hour ?? current.min_rate_per_hour,
        is_dynamic_enabled ?? current.is_dynamic_enabled,
        vip_base_rate_per_hour ?? current.vip_base_rate_per_hour,
        vip_high_occupancy_multiplier ?? current.vip_high_occupancy_multiplier,
        vip_critical_occupancy_multiplier ?? current.vip_critical_occupancy_multiplier,
        id,
      ]
    );

    const row = result.rows[0];
    return NextResponse.json({
      message: 'Pricing configuration saved',
      venue_id: row.id,
      name: row.name,
      base_rate_per_hour: Number(row.base_rate_per_hour),
      high_occupancy_threshold: row.high_occupancy_threshold,
      high_occupancy_multiplier: Number(row.high_occupancy_multiplier),
      critical_occupancy_threshold: row.critical_occupancy_threshold,
      critical_occupancy_multiplier: Number(row.critical_occupancy_multiplier),
      peak_hours: row.peak_hours,
      peak_hour_surcharge: Number(row.peak_hour_surcharge),
      max_rate_per_hour: Number(row.max_rate_per_hour),
      min_rate_per_hour: Number(row.min_rate_per_hour),
      is_dynamic_enabled: row.is_dynamic_enabled,
      vip_base_rate_per_hour: row.vip_base_rate_per_hour ? Number(row.vip_base_rate_per_hour) : null,
      vip_high_occupancy_multiplier: row.vip_high_occupancy_multiplier ? Number(row.vip_high_occupancy_multiplier) : null,
      vip_critical_occupancy_multiplier: row.vip_critical_occupancy_multiplier ? Number(row.vip_critical_occupancy_multiplier) : null,
    });
  } catch (error) {
    console.error('PUT pricing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
