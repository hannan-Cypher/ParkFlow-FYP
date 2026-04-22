import { PoolClient } from 'pg';

export interface VehicleDetails {
    vehicle_type?: string;
    make?: string;
    model?: string;
    color?: string;
}

export interface Slot {
    id: string;
    slot_number: string;
    floor_level: string | null;
    zone: string | null;
    slot_type: string;
    zone_id?: string;
    gate_id?: string;
}

export interface Staff {
    id: string | null;
    full_name: string | null;
}

/**
 * Normalizes license plate to uppercase and strips spaces.
 * Retains hyphens as requested.
 */
export function normalizePlate(plate: string): string {
    return plate.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Resolves a customer ID based on explicit ID or phone number.
 */
export async function resolveCustomerId(
    client: PoolClient,
    customerId?: string,
    customerPhone?: string
): Promise<string | null> {
    if (customerId) return customerId;
    if (!customerPhone) return null;

    const res = await client.query(
        "SELECT id FROM users WHERE phone = $1 AND role = 'customer' LIMIT 1",
        [customerPhone]
    );
    return res.rows[0]?.id || null;
}

/**
 * Finds an existing vehicle or creates a new one.
 */
export async function findOrCreateVehicle(
    client: PoolClient,
    plate: string,
    details: VehicleDetails,
    customerId: string | null
): Promise<string> {
    const res = await client.query(
        "SELECT id FROM vehicles WHERE license_plate = $1",
        [plate]
    );

    if (res.rows.length > 0) {
        const vehicleId = res.rows[0].id;
        await client.query(
            `UPDATE vehicles 
             SET vehicle_type = COALESCE($1, vehicle_type),
                 make = COALESCE($2, make),
                 model = COALESCE($3, model),
                 color = COALESCE($4, color),
                 owner_id = COALESCE($5, owner_id)
             WHERE id = $6`,
            [details.vehicle_type || null, details.make || null, details.model || null, details.color || null, customerId, vehicleId]
        );
        return vehicleId;
    }

    const insertRes = await client.query(
        `INSERT INTO vehicles (license_plate, vehicle_type, make, model, color, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [plate, details.vehicle_type || 'car', details.make || null, details.model || null, details.color || null, customerId]
    );
    return insertRes.rows[0].id;
}

/**
 * Allocates an available slot using gate-aware cascade logic:
 *   1. Prefer zones linked to the specified gate (nearest zones)
 *   2. Fall back to zones of other gates at the same venue (by display_order)
 *   3. Throw 'parking_full' if all slots are taken
 *
 * When gateId is not provided, falls back to venue-wide allocation (backward compat).
 */
export async function allocateSlot(
    client: PoolClient,
    venueId: string,
    requestedClass: string,
    gateId?: string
): Promise<Slot> {
    let res;

    if (gateId) {
        // Gate-aware cascade: same gate first → other gates by display_order
        res = await client.query(
            `SELECT ps.id, ps.slot_number, ps.floor_level, ps.zone, ps.slot_type,
                    ps.zone_id, z.gate_id
             FROM parking_slots ps
             JOIN zones z ON z.id = ps.zone_id
             JOIN gates g ON g.id = z.gate_id
             WHERE ps.venue_id = $1
               AND ps.status = 'available'
               AND ps.slot_type = $3
             ORDER BY
               CASE WHEN z.gate_id = $2 THEN 0 ELSE 1 END ASC,
               g.display_order ASC,
               z.name ASC,
               ps.slot_number ASC
             LIMIT 1
             FOR UPDATE OF ps SKIP LOCKED`,
            [venueId, gateId, requestedClass]
        );
    } else {
        // Legacy venue-wide allocation (no gate specified)
        res = await client.query(
            `SELECT id, slot_number, floor_level, zone, slot_type, zone_id
             FROM parking_slots
             WHERE venue_id = $1 AND status = 'available' AND slot_type = $2
             ORDER BY slot_number ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED`,
            [venueId, requestedClass]
        );
    }

    if (res.rows.length === 0) {
        throw new Error('parking_full');
    }

    const slot = res.rows[0];
    await client.query(
        "UPDATE parking_slots SET status = 'occupied' WHERE id = $1",
        [slot.id]
    );

    return slot;
}

/**
 * Assigns a staff member with zone-aware load balancing:
 *   1. If staffId provided explicitly, use that staff
 *   2. If zoneId provided, pick least-busy on-shift driver assigned to that zone
 *      (via users.zone_id OR staff_duty_assignments.zone_id)
 *   3. Fall back to least-busy driver at the venue if no zone staff found
 */
export async function assignStaff(
    client: PoolClient,
    venueId: string,
    staffId?: string,
    zoneId?: string
): Promise<Staff> {
    if (staffId) {
        const res = await client.query(
            "SELECT id, full_name FROM users WHERE id = $1 LIMIT 1",
            [staffId]
        );
        return {
            id: res.rows[0]?.id || null,
            full_name: res.rows[0]?.full_name || null
        };
    }

    // Try zone-specific staff first (if zone known)
    if (zoneId) {
        const zoneRes = await client.query(
            `SELECT u.id, u.full_name,
                    COUNT(ps.id) FILTER (WHERE ps.status = 'active') AS active_tasks
             FROM users u
             LEFT JOIN parking_sessions ps ON ps.valet_staff_id = u.id AND ps.status = 'active'
             WHERE u.role = 'driver'
               AND u.venue_id = $1
               AND u.is_active = true
               AND (
                 u.zone_id = $2
                 OR EXISTS (
                   SELECT 1 FROM staff_duty_assignments sda
                   WHERE sda.staff_id = u.id AND sda.zone_id = $2
                 )
               )
             GROUP BY u.id, u.full_name
             ORDER BY active_tasks ASC, u.full_name ASC
             LIMIT 1`,
            [venueId, zoneId]
        );

        if (zoneRes.rows.length > 0) {
            return {
                id: zoneRes.rows[0].id,
                full_name: zoneRes.rows[0].full_name
            };
        }
    }

    // Fallback: least-busy driver at the venue (any zone)
    const res = await client.query(
        `SELECT u.id, u.full_name,
                COUNT(ps.id) FILTER (WHERE ps.status = 'active') AS active_tasks
         FROM users u
         LEFT JOIN parking_sessions ps ON ps.valet_staff_id = u.id AND ps.status = 'active'
         WHERE u.role = 'driver'
           AND u.venue_id = $1
           AND u.is_active = true
         GROUP BY u.id, u.full_name
         ORDER BY active_tasks ASC, u.full_name ASC
         LIMIT 1`,
        [venueId]
    );

    return {
        id: res.rows[0]?.id || null,
        full_name: res.rows[0]?.full_name || null
    };
}
