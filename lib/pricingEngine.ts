import pool from './db';

export interface PricingMetadata {
  requested_class: 'standard' | 'vip';
  base_rate: number;
  applied_rate: number;
  occupancy_percent: number;
  occupancy_multiplier_used: number;
  peak_surcharge_applied: number;
  is_peak_hour: boolean;
  peak_label: string | null;
  is_dynamic_enabled: boolean;
}

interface PeakHourWindow {
  start: string; // "HH:MM" 24-hr
  end: string;
  label: string;
}

/**
 * Returns true if `timeStr` (e.g. "17:45") falls within [start, end) (both "HH:MM").
 * Handles overnight windows (start > end) as well.
 */
function isInWindow(timeStr: string, start: string, end: string): boolean {
  const [th, tm] = timeStr.split(':').map(Number);
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  const t = th * 60 + tm;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;

  if (s <= e) {
    return t >= s && t < e;
  }
  // Overnight window
  return t >= s || t < e;
}

/**
 * Calculates the dynamic rate for a given venue and returns both the rate
 * and a full metadata snapshot suitable for storing on parking_sessions.
 *
 * Parameters:
 *   venueId: string
 *   requestedClass: 'standard' | 'vip'
 *
 * Pakistan Standard Time is UTC+5.
 */
export async function calculateDynamicRate(
  venueId: string,
  requestedClass: 'standard' | 'vip' = 'standard'
): Promise<PricingMetadata> {
  // Fetch venue pricing config + occupied slot counts per class in one query
  const venueResult = await pool.query(
    `SELECT
       v.*,
       (SELECT COUNT(*) FROM parking_slots s 
        WHERE s.venue_id = v.id AND s.slot_type = 'standard' AND s.status != 'maintenance') AS total_standard_slots,
       (SELECT COUNT(*) FROM parking_slots s 
        WHERE s.venue_id = v.id AND s.slot_type = 'vip' AND s.status != 'maintenance') AS total_vip_slots,
       (SELECT COUNT(*) FROM parking_sessions ps
        WHERE ps.venue_id = v.id AND ps.status = 'active' AND ps.requested_class = 'standard') AS active_standard,
       (SELECT COUNT(*) FROM parking_sessions ps
        WHERE ps.venue_id = v.id AND ps.status = 'active' AND ps.requested_class = 'vip') AS active_vip
     FROM venues v
     WHERE v.id = $1`,
    [venueId]
  );

  if (venueResult.rows.length === 0) {
    throw new Error(`Venue ${venueId} not found`);
  }

  const r = venueResult.rows[0];
  const isVip = requestedClass === 'vip';

  // Determine base rate and occupancy based on class
  const baseRate = isVip
    ? Number(r.vip_base_rate_per_hour || r.base_rate_per_hour * 2)
    : Number(r.base_rate_per_hour);

  const totalSlotsOfClass = isVip
    ? Number(r.total_vip_slots)
    : Number(r.total_standard_slots);

  const activeSessionsOfClass = isVip
    ? Number(r.active_vip)
    : Number(r.active_standard);

  const occupancyPercent = totalSlotsOfClass > 0
    ? (activeSessionsOfClass / totalSlotsOfClass) * 100
    : 0;

  // Use class-specific multipliers
  const highThreshold = Number(r.high_occupancy_threshold || 80);
  const highMultiplier = isVip
    ? Number(r.vip_high_occupancy_multiplier || 1.5)
    : Number(r.high_occupancy_multiplier || 1.2);

  const criticalThreshold = Number(r.critical_occupancy_threshold || 95);
  const criticalMultiplier = isVip
    ? Number(r.vip_critical_occupancy_multiplier || 2.0)
    : Number(r.critical_occupancy_multiplier || 1.5);

  // If dynamic pricing is disabled, return flat base rate
  if (!r.is_dynamic_enabled) {
    return {
      requested_class: requestedClass,
      base_rate: baseRate,
      applied_rate: baseRate,
      occupancy_percent: Math.round(occupancyPercent * 10) / 10,
      occupancy_multiplier_used: 1.0,
      peak_surcharge_applied: 0,
      is_peak_hour: false,
      peak_label: null,
      is_dynamic_enabled: false,
    };
  }

  // ── Occupancy multiplier ──────────────────────────────────────────────────
  let multiplierUsed = 1.0;
  if (occupancyPercent >= criticalThreshold) {
    multiplierUsed = criticalMultiplier;
  } else if (occupancyPercent >= highThreshold) {
    multiplierUsed = highMultiplier;
  }

  let rate = baseRate * multiplierUsed;

  // ── Peak hour surcharge ───────────────────────────────────────────────────
  // Same for both classes unless user wants different peak surcharges per class later.
  const nowUtc = new Date();
  const pkMinutes = (nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes() + 300) % (24 * 60);
  const pkHours = Math.floor(pkMinutes / 60);
  const pkMins = pkMinutes % 60;
  const currentTimeStr = `${String(pkHours).padStart(2, '0')}:${String(pkMins).padStart(2, '0')}`;

  const peakWindows: PeakHourWindow[] = Array.isArray(r.peak_hours) ? r.peak_hours : [];
  let isPeakHour = false;
  let peakLabel: string | null = null;
  let peakSurchargeApplied = 0;

  for (const window of peakWindows) {
    if (isInWindow(currentTimeStr, window.start, window.end)) {
      isPeakHour = true;
      peakLabel = window.label;
      peakSurchargeApplied = Number(r.peak_hour_surcharge || 0);
      rate += peakSurchargeApplied;
      break;
    }
  }

  // ── Clamp to min/max ──────────────────────────────────────────────────────
  const minRate = Number(r.min_rate_per_hour || 0);
  const maxRate = Number(r.max_rate_per_hour || 9999);
  rate = Math.min(Math.max(rate, minRate), maxRate);

  return {
    requested_class: requestedClass,
    base_rate: baseRate,
    applied_rate: Math.round(rate * 100) / 100,
    occupancy_percent: Math.round(occupancyPercent * 10) / 10,
    occupancy_multiplier_used: multiplierUsed,
    peak_surcharge_applied: peakSurchargeApplied,
    is_peak_hour: isPeakHour,
    peak_label: peakLabel,
    is_dynamic_enabled: true,
  };
}
