import { QueryResult } from 'pg';

/**
 * Minimal query interface accepted by findAvailableStaff.
 * Both Pool and PoolClient from pg satisfy this interface.
 */
interface QueryRunner {
  query(queryText: string, values?: unknown[]): Promise<QueryResult>;
}

export interface StaffAssignmentParams {
  /** The venue to find staff in. Never crosses venue boundaries. */
  venueId: string;
  /** Optional zone to pin the search to. Falls back to venue-wide if empty. */
  zoneId?: string;
  /** 'driver' for parking tasks, 'washer' for wash tasks. */
  requiredRole: 'driver' | 'washer';
  /** Optional staff ID to exclude (e.g., already assigned to the session). */
  excludeStaffId?: string;
  /** Explicit staff override. If provided, bypasses all load-balancing logic. */
  staffId?: string;
}

export interface StaffAssignmentResult {
  id: string | null;
  full_name: string | null;
}

/**
 * Unified staff assignment with zone-pinned then venue-fallback logic.
 *
 * Priority:
 *   1. If staffId provided explicitly → verify and return that staff
 *   2. If zoneId provided → find least-busy on-shift staff assigned to that zone
 *   3. Fallback → find least-busy on-shift staff at the venue (any zone, same venue)
 *
 * Only staff with an active shift (`staff_shifts.status = 'active'`) are eligible.
 * Load is measured by role-specific active task counts.
 */
export async function findAvailableStaff(
  client: QueryRunner,
  params: StaffAssignmentParams
): Promise<StaffAssignmentResult> {
  const { venueId, zoneId, requiredRole, excludeStaffId, staffId } = params;

  // ── 1. Explicit staff override ──────────────────────────────────────────
  if (staffId) {
    const res = await client.query(
      `SELECT u.id, u.full_name
       FROM users u
       WHERE u.id = $1
         AND u.role = $2
         AND u.venue_id = $3
       LIMIT 1`,
      [staffId, requiredRole, venueId]
    );
    return {
      id: res.rows[0]?.id || null,
      full_name: res.rows[0]?.full_name || null,
    };
  }

  // ── 2. Zone-pinned search (try slot's zone first) ───────────────────────
  if (zoneId) {
    const zoneRes = await queryLeastBusy(client, venueId, requiredRole, zoneId, excludeStaffId);
    if (zoneRes.rows.length > 0) {
      return {
        id: zoneRes.rows[0].id,
        full_name: zoneRes.rows[0].full_name,
      };
    }
  }

  // ── 3. Venue-wide fallback (any zone, same venue) ───────────────────────
  const fallbackRes = await queryLeastBusy(client, venueId, requiredRole, undefined, excludeStaffId);
  return {
    id: fallbackRes.rows[0]?.id || null,
    full_name: fallbackRes.rows[0]?.full_name || null,
  };
}

// ── Shared SQL Builder ──────────────────────────────────────────────────────────

function queryLeastBusy(
  client: QueryRunner,
  venueId: string,
  role: 'driver' | 'washer',
  zoneId?: string,
  excludeStaffId?: string
) {
  // Role-specific task counting table and filter condition
  const taskTable = role === 'driver'
    ? 'parking_sessions'
    : 'service_requests';
  const taskFilter = role === 'driver'
    ? "ps.status = 'active'"
    : "sr.service_status IN ('pending', 'in_progress')";
  const taskJoin = role === 'driver'
    ? `LEFT JOIN parking_sessions ps ON ps.valet_staff_id = u.id AND ps.status = 'active'`
    : `LEFT JOIN service_requests sr ON sr.assigned_to = u.id AND sr.service_status IN ('pending', 'in_progress')`;
  const taskCountExpr = role === 'driver'
    ? `COUNT(ps.id) FILTER (WHERE ps.status = 'active')`
    : `COUNT(sr.id) FILTER (WHERE sr.service_status IN ('pending', 'in_progress'))`;

  const zoneClause = zoneId
    ? `AND (
         u.zone_id = $3
         OR EXISTS (
           SELECT 1 FROM staff_duty_assignments sda
           WHERE sda.staff_id = u.id AND sda.zone_id = $3
         )
       )`
    : '';

  const excludeClause = excludeStaffId ? 'AND u.id != $4' : '';
  const params = [role, venueId];
  if (zoneId) params.push(zoneId);
  if (excludeStaffId) params.push(excludeStaffId);

  const sql = `
    SELECT u.id, u.full_name, ${taskCountExpr} AS active_tasks
    FROM users u
    LEFT JOIN staff_shifts ss ON ss.staff_id = u.id AND ss.status = 'active'
    ${taskJoin}
    WHERE u.role = $1
      AND u.venue_id = $2
      AND ss.id IS NOT NULL
      ${zoneClause}
      ${excludeClause}
    GROUP BY u.id, u.full_name
    ORDER BY active_tasks ASC, u.full_name ASC
    LIMIT 1
  `;

  return client.query(sql, params);
}
