import pool from './db';

export interface PricingMetadata {
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
 * Pakistan Standard Time is UTC+5.
 */
export async function calculateDynamicRate(venueId: string): Promise<PricingMetadata> {
  // Fetch venue pricing config + occupied slot count in one query
  const venueResult = await pool.query(
    `SELECT
       v.total_slots,
       v.base_rate_per_hour,
       v.high_occupancy_threshold,
       v.high_occupancy_multiplier,
       v.critical_occupancy_threshold,
       v.critical_occupancy_multiplier,
       v.peak_hours,
       v.peak_hour_surcharge,
       v.max_rate_per_hour,
       v.min_rate_per_hour,
       v.is_dynamic_enabled,
       COUNT(ps.id) AS active_sessions
     FROM venues v
     LEFT JOIN parking_sessions ps
       ON ps.venue_id = v.id AND ps.status = 'active'
     WHERE v.id = $1
     GROUP BY v.id`,
    [venueId]
  );

  if (venueResult.rows.length === 0) {
    throw new Error(`Venue ${venueId} not found`);
  }

  const r = venueResult.rows[0];
  const baseRate = Number(r.base_rate_per_hour);
  const totalSlots = Number(r.total_slots) || 1;
  const activeSessions = Number(r.active_sessions);
  const occupancyPercent = (activeSessions / totalSlots) * 100;

  // If dynamic pricing is disabled, return flat base rate
  if (!r.is_dynamic_enabled) {
    return {
      base_rate: baseRate,
      applied_rate: baseRate,
      occupancy_percent: occupancyPercent,
      occupancy_multiplier_used: 1.0,
      peak_surcharge_applied: 0,
      is_peak_hour: false,
      peak_label: null,
      is_dynamic_enabled: false,
    };
  }

  // ── Occupancy multiplier ──────────────────────────────────────────────────
  let multiplierUsed = 1.0;
  if (occupancyPercent >= Number(r.critical_occupancy_threshold)) {
    multiplierUsed = Number(r.critical_occupancy_multiplier);
  } else if (occupancyPercent >= Number(r.high_occupancy_threshold)) {
    multiplierUsed = Number(r.high_occupancy_multiplier);
  }

  let rate = baseRate * multiplierUsed;

  // ── Peak hour surcharge ───────────────────────────────────────────────────
  // Get current Pakistan Standard Time (UTC+5)
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
      peakSurchargeApplied = Number(r.peak_hour_surcharge);
      rate += peakSurchargeApplied;
      break;
    }
  }

  // ── Clamp to min/max ──────────────────────────────────────────────────────
  const minRate = Number(r.min_rate_per_hour);
  const maxRate = Number(r.max_rate_per_hour);
  rate = Math.min(Math.max(rate, minRate), maxRate);

  return {
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
