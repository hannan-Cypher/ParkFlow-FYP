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
}

export interface Staff {
    id: string | null;
    full_name: string | null;
}

/**
 * Normalizes license plate to uppercase and strips spaces/hyphens.
 */
export function normalizePlate(plate: string): string {
    return plate.trim().toUpperCase().replace(/[\s\-]+/g, '');
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
 * Allocates an available slot of the requested class.
 */
export async function allocateSlot(
    client: PoolClient,
    venueId: string,
    requestedClass: string
): Promise<Slot> {
    const res = await client.query(
        `SELECT id, slot_number, floor_level, zone, slot_type
         FROM parking_slots
         WHERE venue_id = $1 AND status = 'available' AND slot_type = $2
         ORDER BY slot_number ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        [venueId, requestedClass]
    );

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
 * Assigns a staff member based on current workload.
 */
export async function assignStaff(
    client: PoolClient,
    venueId: string,
    staffId?: string
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
