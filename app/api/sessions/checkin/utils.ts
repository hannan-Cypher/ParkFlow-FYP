import { PoolClient } from 'pg';
import { findAvailableStaff } from '@/lib/staffAssignment';

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
 * Allocates an available slot using zone-aware cascade logic:
 *   1. Prefer slots in the staff's assigned zone (zone-pinned)
 *   2. Fall back to zones linked to the same gate
 *   3. Fall back to zones of other gates at the same venue (by display_order)
 *   4. Throw 'parking_full' if all slots are taken
 *
 * When gateId is not provided, falls back to venue-wide allocation (backward compat).
 */
export async function allocateSlot(
    client: PoolClient,
    venueId: string,
    requestedClass: string,
    gateId?: string,
    staffZoneId?: string
): Promise<Slot> {
    let res;

    if (gateId) {
        // Zone-aware cascade: staff's zone → same gate → other gates by display_order
        const params: unknown[] = [venueId, gateId, requestedClass];
        let zonePinnedClause = '';
        if (staffZoneId) {
            zonePinnedClause = `CASE WHEN ps.zone_id = $4 THEN 0 ELSE 1 END ASC,`;
            params.push(staffZoneId);
        }

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
               ${zonePinnedClause}
               CASE WHEN z.gate_id = $2 THEN 0 ELSE 1 END ASC,
               g.display_order ASC,
               z.name ASC,
               ps.slot_number ASC
             LIMIT 1
             FOR UPDATE OF ps SKIP LOCKED`,
            params
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
 * Assigns a staff member with zone-aware load balancing.
 *
 * Thin wrapper around the unified `findAvailableStaff()` in lib/staffAssignment.ts.
 * Kept for backward compatibility — checkin route imports { assignStaff }.
 *
 * Priority:
 *   1. If staffId provided explicitly, use that staff
 *   2. If zoneId provided, pick least-busy on-shift driver assigned to that zone
 *      (via users.zone_id OR staff_duty_assignments.zone_id)
 *   3. Fall back to least-busy driver at the venue if no zone staff found
 *
 * Only staff with active shifts (`staff_shifts.status = 'active'`) are eligible.
 */
export async function assignStaff(
    client: PoolClient,
    venueId: string,
    staffId?: string,
    zoneId?: string
): Promise<Staff> {
    const result = await findAvailableStaff(client, {
        venueId,
        zoneId,
        requiredRole: 'driver',
        staffId,
    });
    return { id: result.id, full_name: result.full_name };
}
/**
 * Derives the gate_id from the staff member's assigned zone.
 * Used for signaling when gate_id is not explicitly provided.
 */
export async function deriveGateIdFromStaff(
    client: PoolClient,
    staffId?: string,
    venueId?: string
): Promise<string | null> {
    if (!staffId || !venueId) return null;

    const res = await client.query(
        `SELECT z.gate_id
         FROM users u
         JOIN zones z ON z.id = u.zone_id
         WHERE u.id = $1 AND u.venue_id = $2`,
        [staffId, venueId]
    );

    return res.rows[0]?.gate_id || null;
}

/**
 * Derives the zone_id from the staff member's assigned zone.
 * Used by allocateSlot to pin slot selection to the staff's zone first.
 */
export async function deriveStaffZone(
    client: PoolClient,
    staffId?: string,
    venueId?: string
): Promise<string | null> {
    if (!staffId || !venueId) return null;

    const res = await client.query(
        'SELECT zone_id FROM users WHERE id = $1 AND venue_id = $2',
        [staffId, venueId]
    );

    return res.rows[0]?.zone_id || null;
}
