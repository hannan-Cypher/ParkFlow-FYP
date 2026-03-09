import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * POST /api/sessions/checkin
 *
 * Check in a vehicle with:
 *   1. Slot-Type Priority Allocation — matches vehicle type to best slot type
 *   2. Auto Staff Assignment — picks the least-busy staff at the venue
 *
 * Body:
 *   license_plate          (required) — e.g. "LEA-1234"
 *   venue_id               (required) — UUID of the parking venue
 *   staff_id               (optional) — manually assign staff; otherwise auto-assigned
 *   customer_id            (optional) — UUID of the customer (if known)
 *   customer_phone         (optional) — phone number to look up / link the customer
 *   vehicle_type           (optional) — "sedan", "suv", "hatchback", "pickup", "van", "car"
 *   make                   (optional) — e.g. "Toyota"
 *   model                  (optional) — e.g. "Corolla"
 *   color                  (optional) — e.g. "White"
 *   entry_plate_confidence (optional) — ANPR confidence 0-1
 *   customer_notes         (optional) — text
 */

// ── Slot-Type Priority Map ──────────────────────────────────────────────────
// Maps a vehicle type to preferred slot types in priority order.
// The algorithm tries the first type, then falls back through the list.
const SLOT_PRIORITY: Record<string, string[]> = {
    sedan: ['standard', 'vip', 'electric', 'compact'],
    suv: ['standard', 'vip', 'electric'],
    pickup: ['standard', 'vip'],
    van: ['standard', 'vip'],
    hatchback: ['compact', 'standard', 'electric', 'vip'],
    car: ['standard', 'compact', 'vip', 'electric'],
}

export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        const body = await request.json();
        const {
            license_plate,
            venue_id,
            staff_id,
            customer_id,
            customer_phone,
            vehicle_type,
            make,
            model,
            color,
            entry_plate_confidence,
            customer_notes,
        } = body;

        // ── Validation ──────────────────────────────────────────────────────────
        if (!license_plate || !venue_id) {
            return NextResponse.json(
                { error: 'license_plate and venue_id are required' },
                { status: 400 }
            );
        }

        const plate = license_plate.trim().toUpperCase();

        // ── Start transaction ───────────────────────────────────────────────────
        await client.query('BEGIN');

        // ── 1. Check venue exists ───────────────────────────────────────────────
        const venueResult = await client.query(
            'SELECT id, name FROM venues WHERE id = $1',
            [venue_id]
        );
        const venue = venueResult.rows[0];
        if (!venue) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: 'Venue not found' }, { status: 404 });
        }

        // ── 2. Check for duplicate active session ───────────────────────────────
        const dupCheck = await client.query(
            `SELECT ps.id FROM parking_sessions ps
       JOIN vehicles v ON v.id = ps.vehicle_id
       WHERE v.license_plate = $1 AND ps.status = 'active'`,
            [plate]
        );
        if (dupCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(
                { error: `Vehicle ${plate} already has an active parking session` },
                { status: 409 }
            );
        }

        // ── 3. Resolve customer_id ──────────────────────────────────────────────
        // Priority: explicit customer_id > phone lookup > vehicle owner
        let resolvedCustomerId: string | null = customer_id || null;

        if (!resolvedCustomerId && customer_phone) {
            const phoneResult = await client.query(
                `SELECT id FROM users WHERE phone = $1 AND role = 'customer' LIMIT 1`,
                [customer_phone.trim()]
            );
            if (phoneResult.rows.length > 0) {
                resolvedCustomerId = phoneResult.rows[0].id;
            }
        }

        // ── 4. Find or create vehicle ───────────────────────────────────────────
        let vehicleId: string;
        let resolvedVehicleType = vehicle_type || 'car';
        const vehicleResult = await client.query(
            'SELECT id, owner_id, vehicle_type FROM vehicles WHERE license_plate = $1',
            [plate]
        );

        if (vehicleResult.rows.length > 0) {
            vehicleId = vehicleResult.rows[0].id;
            resolvedVehicleType = vehicleResult.rows[0].vehicle_type || resolvedVehicleType;

            // Update make/model/color/owner if new info was provided
            await client.query(
                `UPDATE vehicles
                 SET vehicle_type = COALESCE($1, vehicle_type),
                     make         = COALESCE($2, make),
                     model        = COALESCE($3, model),
                     color        = COALESCE($4, color),
                     owner_id     = COALESCE($5, owner_id)
                 WHERE id = $6`,
                [
                    vehicle_type || null,
                    make || null,
                    model || null,
                    color || null,
                    resolvedCustomerId || vehicleResult.rows[0].owner_id || null,
                    vehicleId,
                ]
            );
        } else {
            // New vehicle — insert with all available details
            const newVehicle = await client.query(
                `INSERT INTO vehicles (license_plate, vehicle_type, make, model, color, owner_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [
                    plate,
                    resolvedVehicleType,
                    make || null,
                    model || null,
                    color || null,
                    resolvedCustomerId,
                ]
            );
            vehicleId = newVehicle.rows[0].id;
        }

        // Fall back to vehicle's registered owner if no customer resolved yet
        if (!resolvedCustomerId) {
            resolvedCustomerId = vehicleResult.rows[0]?.owner_id || null;
        }

        // ── 5. SLOT-TYPE PRIORITY ALLOCATION ────────────────────────────────────
        //
        // Try each preferred slot type in order. If the preferred type has no
        // available slots, fall back to the next type. Uses FOR UPDATE to lock
        // the selected row and prevent race conditions.
        //
        const preferredTypes = SLOT_PRIORITY[resolvedVehicleType] || SLOT_PRIORITY['car'];
        let slot: { id: string; slot_number: string; floor_level: string; zone: string; slot_type: string } | null = null;
        let allocationMethod = 'fallback';

        for (const slotType of preferredTypes) {
            const slotResult = await client.query(
                `SELECT id, slot_number, floor_level, zone, slot_type
         FROM parking_slots
         WHERE venue_id = $1 AND status = 'available' AND slot_type = $2
         ORDER BY slot_number ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
                [venue_id, slotType]
            );

            if (slotResult.rows.length > 0) {
                slot = slotResult.rows[0];
                allocationMethod = `priority_${slotType}`;
                break;
            }
        }

        // Ultimate fallback: any available slot regardless of type
        if (!slot) {
            const fallbackResult = await client.query(
                `SELECT id, slot_number, floor_level, zone, slot_type
         FROM parking_slots
         WHERE venue_id = $1 AND status = 'available'
         ORDER BY slot_number ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
                [venue_id]
            );

            if (fallbackResult.rows.length > 0) {
                slot = fallbackResult.rows[0];
                allocationMethod = 'fallback_any';
            }
        }

        if (!slot) {
            await client.query('ROLLBACK');
            return NextResponse.json(
                { error: 'No available parking slots at this venue' },
                { status: 422 }
            );
        }

        // ── 6. Mark slot as occupied ────────────────────────────────────────────
        await client.query(
            `UPDATE parking_slots SET status = 'occupied' WHERE id = $1`,
            [slot.id]
        );

        // ── 7. AUTO STAFF ASSIGNMENT ────────────────────────────────────────────
        //
        // If no staff_id was passed, pick the staff member at this venue who
        // currently has the fewest active sessions (least busy).
        //
        let assignedStaffId = staff_id || null;
        let assignedStaffName: string | null = null;

        if (!assignedStaffId) {
            const staffResult = await client.query(
                `SELECT u.id, u.full_name,
                COUNT(ps.id) FILTER (WHERE ps.status = 'active') AS active_tasks
         FROM users u
         LEFT JOIN parking_sessions ps ON ps.valet_staff_id = u.id AND ps.status = 'active'
         WHERE u.role = 'valet_staff'
           AND u.venue_id = $1
           AND u.is_active = true
         GROUP BY u.id, u.full_name
         ORDER BY active_tasks ASC, u.full_name ASC
         LIMIT 1`,
                [venue_id]
            );

            if (staffResult.rows.length > 0) {
                assignedStaffId = staffResult.rows[0].id;
                assignedStaffName = staffResult.rows[0].full_name;
            }
        } else {
            // Look up the manually-assigned staff name
            const manualStaff = await client.query(
                'SELECT full_name FROM users WHERE id = $1',
                [staff_id]
            );
            assignedStaffName = manualStaff.rows[0]?.full_name || null;
        }

        // ── 8. Create parking session ───────────────────────────────────────────
        const ratePerHour = 100;

        const sessionResult = await client.query(
            `INSERT INTO parking_sessions
         (vehicle_id, customer_id, venue_id, slot_id, valet_staff_id,
          entry_plate_confidence, rate_per_hour, customer_notes, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 'pending')
       RETURNING *`,
            [
                vehicleId,
                resolvedCustomerId,
                venue_id,
                slot.id,
                assignedStaffId,
                entry_plate_confidence ?? null,
                ratePerHour,
                customer_notes || null,
            ]
        );

        const session = sessionResult.rows[0];

        // ── 9. Set qr_code = session id (for QR display) ────────────────────────
        await client.query(
            `UPDATE parking_sessions SET qr_code = $1 WHERE id = $1`,
            [session.id]
        );

        // ── Commit ──────────────────────────────────────────────────────────────
        await client.query('COMMIT');

        // ── Return enriched response ────────────────────────────────────────────
        return NextResponse.json(
            {
                message: 'Vehicle checked in successfully',
                session: {
                    id: session.id,
                    status: session.status,
                    entry_time: session.entry_time,
                    rate_per_hour: Number(session.rate_per_hour),
                    qr_code: session.id,
                    allocation_method: allocationMethod,
                    vehicle: {
                        id: vehicleId,
                        license_plate: plate,
                        vehicle_type: resolvedVehicleType,
                        make: make || null,
                        model: model || null,
                        color: color || null,
                    },
                    slot: {
                        id: slot.id,
                        slot_number: slot.slot_number,
                        floor_level: slot.floor_level,
                        zone: slot.zone,
                        slot_type: slot.slot_type,
                    },
                    venue: {
                        id: venue.id,
                        name: venue.name,
                    },
                    staff: assignedStaffId
                        ? { id: assignedStaffId, name: assignedStaffName }
                        : null,
                    customer: resolvedCustomerId
                        ? { id: resolvedCustomerId }
                        : null,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Check-in error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    } finally {
        client.release();
    }
}
