import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getAuthUser } from '@/lib/getUser';

/**
 * GET /api/sessions
 *
 * List parking sessions with ROLE-BASED filtering:
 *   • admin        → sees ALL sessions across all venues
 *   • customer     → sees only sessions for THEIR vehicles (across all venues)
 *   • valet_staff  → sees only sessions at THEIR assigned venue
 *
 * Query params:
 *   status   — 'active' | 'completed' | 'all' (default: 'active')
 *   venue_id — filter by venue (admin only, staff is auto-filtered)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status') || 'active';
        const venueIdParam = searchParams.get('venue_id');

        // ── Authenticate ──────────────────────────────────────────────────────
        const user = await getAuthUser(request);

        // ── Build query depending on role ─────────────────────────────────────
        let whereConditions = '';
        const params: (string | null)[] = [];
        let paramIndex = 1;

        // Status filter
        if (statusFilter !== 'all') {
            whereConditions += ` AND ps.status = $${paramIndex}`;
            params.push(statusFilter);
            paramIndex++;
        }

        if (user) {
            if (user.role === 'customer') {
                // Customer: only their vehicles (via vehicle owner_id)
                whereConditions += ` AND v.owner_id = $${paramIndex}`;
                params.push(user.id);
                paramIndex++;
            } else if (user.role === 'valet_staff') {
                // Staff: only their assigned venue
                if (user.venue_id) {
                    whereConditions += ` AND ps.venue_id = $${paramIndex}`;
                    params.push(user.venue_id);
                    paramIndex++;
                }
            } else if (user.role === 'admin') {
                // Admin: optional venue filter from query param
                if (venueIdParam) {
                    whereConditions += ` AND ps.venue_id = $${paramIndex}`;
                    params.push(venueIdParam);
                    paramIndex++;
                }
            }
        } else {
            // No auth — if venue_id was passed, filter by it (public / unauthenticated fallback)
            if (venueIdParam) {
                whereConditions += ` AND ps.venue_id = $${paramIndex}`;
                params.push(venueIdParam);
                paramIndex++;
            }
        }

        const query = `
      SELECT
        ps.id,
        ps.status,
        ps.entry_time,
        ps.exit_time,
        ps.rate_per_hour,
        ps.total_hours,
        ps.total_amount,
        ps.payment_status,
        ps.customer_notes,
        ps.staff_notes,
        ps.entry_plate_confidence,
        v.id          AS vehicle_id,
        v.license_plate,
        v.make,
        v.model,
        v.color,
        v.vehicle_type,
        sl.id           AS slot_id,
        sl.slot_number,
        sl.floor_level,
        sl.zone,
        sl.slot_type,
        ve.id           AS venue_id,
        ve.name         AS venue_name,
        ve.address      AS venue_address,
        ve.city         AS venue_city,
        staff.full_name AS staff_name,
        cust.full_name  AS customer_name
      FROM parking_sessions ps
      JOIN vehicles v      ON v.id  = ps.vehicle_id
      LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
      LEFT JOIN venues ve  ON ve.id = ps.venue_id
      LEFT JOIN users staff ON staff.id = ps.valet_staff_id
      LEFT JOIN users cust  ON cust.id  = ps.customer_id
      WHERE 1=1 ${whereConditions}
      ORDER BY ps.entry_time DESC
      LIMIT 200
    `;

        const result = await pool.query(query, params);

        // ── Shape the response ──────────────────────────────────────────────────
        const sessions = result.rows.map((row) => {
            // Calculate live duration for active sessions
            let duration = null;
            if (row.status === 'active') {
                const ms = Date.now() - new Date(row.entry_time).getTime();
                const h = Math.floor(ms / 3600000);
                const m = Math.round((ms % 3600000) / 60000);
                duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
            } else if (row.total_hours) {
                const h = Math.floor(Number(row.total_hours));
                const m = Math.round((Number(row.total_hours) - h) * 60);
                duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
            }

            return {
                id: row.id,
                status: row.status,
                entry_time: row.entry_time,
                exit_time: row.exit_time,
                duration,
                rate_per_hour: Number(row.rate_per_hour),
                total_hours: row.total_hours ? Number(row.total_hours) : null,
                total_amount: row.total_amount ? Number(row.total_amount) : null,
                payment_status: row.payment_status,
                entry_plate_confidence: row.entry_plate_confidence
                    ? Number(row.entry_plate_confidence)
                    : null,
                customer_notes: row.customer_notes,
                staff_notes: row.staff_notes,
                vehicle: {
                    id: row.vehicle_id,
                    license_plate: row.license_plate,
                    make: row.make,
                    model: row.model,
                    color: row.color,
                    vehicle_type: row.vehicle_type,
                },
                slot: row.slot_id
                    ? {
                        id: row.slot_id,
                        slot_number: row.slot_number,
                        floor_level: row.floor_level,
                        zone: row.zone,
                        slot_type: row.slot_type,
                    }
                    : null,
                venue: {
                    id: row.venue_id,
                    name: row.venue_name,
                    address: row.venue_address,
                    city: row.venue_city,
                },
                staff_name: row.staff_name,
                customer_name: row.customer_name,
            };
        });

        return NextResponse.json(
            {
                sessions,
                total: sessions.length,
                filters: {
                    status: statusFilter,
                    role: user?.role || 'unauthenticated',
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('List sessions error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
