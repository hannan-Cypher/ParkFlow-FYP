import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { calculateDynamicRate } from '@/lib/pricingEngine';
import { generateMagicToken } from '@/lib/auth';
import {
    normalizePlate,
    resolveCustomerId,
    findOrCreateVehicle,
    allocateSlot,
    assignStaff
} from './utils';

export const dynamic = 'force-dynamic';

// ── SMS Code Generation ─────────────────────────────────────────────────────
const SAFE_CHARS = '2346799ACDEFGHJKMNPQRTUVWXYZ';

function generateSmsCode(): string {
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
    }
    return code;
}

/**
 * POST /api/sessions/checkin
 *
 * Check in a vehicle using modularized logic for slot allocation and staff assignment.
 */
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
            requested_class = 'standard',
        } = body;

        // ── Validation ──────────────────────────────────────────────────────────
        if (!license_plate || !venue_id) {
            return NextResponse.json(
                { error: 'license_plate and venue_id are required' },
                { status: 400 }
            );
        }

        const plate = normalizePlate(license_plate);

        // ── Start transaction ───────────────────────────────────────────────────
        await client.query('BEGIN');

        // ── 1. Check venue exists ──────────────────────────────────────────────
        const venueResult = await client.query(
            "SELECT id, name, address, contact_phone, total_slots FROM venues WHERE id = $1",
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
        const resolvedCustomerId = await resolveCustomerId(client, customer_id, customer_phone);

        // ── 4. Find or create vehicle ───────────────────────────────────────────
        const vehicleId = await findOrCreateVehicle(
            client,
            plate,
            { vehicle_type, make, model, color },
            resolvedCustomerId
        );

        // ── 5. Slot Allocation ──────────────────────────────────────────────────
        let slot;
        try {
            slot = await allocateSlot(client, venue_id, requested_class);
        } catch (err: any) {
            await client.query('ROLLBACK');
            return NextResponse.json(
                { error: err.message === 'parking_full' ? `No ${requested_class} slots available.` : err.message },
                { status: 422 }
            );
        }

        // ── 6. Staff Assignment ─────────────────────────────────────────────────
        const staff = await assignStaff(client, venue_id, staff_id);

        // ── 7. Create parking session ───────────────────────────────────────────
        const pricingMeta = await calculateDynamicRate(venue_id, requested_class as 'standard' | 'vip');
        const ratePerHour = pricingMeta.applied_rate;

        let smsCode = generateSmsCode();
        for (let attempt = 0; attempt < 3; attempt++) {
            const collision = await client.query(
                `SELECT 1 FROM parking_sessions WHERE sms_code = $1 AND status = 'active' LIMIT 1`,
                [smsCode]
            );
            if (collision.rows.length === 0) break;
            smsCode = generateSmsCode();
        }

        const sessionResult = await client.query(
            `INSERT INTO parking_sessions
         (vehicle_id, customer_id, venue_id, slot_id, valet_staff_id,
          entry_plate_confidence, rate_per_hour, customer_notes, status, payment_status,
          pricing_metadata, sms_code, requested_class)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 'pending', $9, $10, $11)
       RETURNING *`,
            [
                vehicleId,
                resolvedCustomerId,
                venue_id,
                slot.id,
                staff.id,
                entry_plate_confidence ?? null,
                ratePerHour,
                customer_notes || null,
                JSON.stringify(pricingMeta),
                smsCode,
                requested_class,
            ]
        );

        const session = sessionResult.rows[0];

        // ── Fetch customer name/phone for the response ──────────────────────────
        let customerName: string | null = null;
        let customerPhone: string | null = customer_phone || null;
        if (resolvedCustomerId) {
            const custResult = await client.query(
                'SELECT full_name, phone FROM users WHERE id = $1',
                [resolvedCustomerId]
            );
            if (custResult.rows.length > 0) {
                customerName = custResult.rows[0].full_name ?? null;
                customerPhone = customerPhone ?? custResult.rows[0].phone ?? null;
            }
        }

        // ── 8. Set qr_code = session id (for QR display) ────────────────────────
        await client.query(
            `UPDATE parking_sessions SET qr_code = $1 WHERE id = $1`,
            [session.id]
        );

        // ── 9. Generate magic link token for returning customers ────────────────
        let magicToken: string | null = null;
        if (resolvedCustomerId) {
            magicToken = generateMagicToken();
            await client.query(
                `INSERT INTO magic_links (token, user_id, session_id, expires_at)
                 VALUES ($1, $2, $3, NOW() + INTERVAL '24 hours')`,
                [magicToken, resolvedCustomerId, session.id]
            );
            await client.query(
                `DELETE FROM magic_links WHERE expires_at < NOW() - INTERVAL '7 days'`
            );
        }

        await client.query('COMMIT');

        return NextResponse.json(
            {
                message: 'Vehicle checked in successfully',
                session: {
                    id: session.id,
                    qr_code: session.id,
                    license_plate: plate,
                    status: session.status,
                    payment_status: session.payment_status,
                    entry_time: session.entry_time,
                    rate_per_hour: Number(session.rate_per_hour),
                    sms_code: session.sms_code,
                    venue_name: venue.name,
                    venue_address: venue.address ?? null,
                    venue_phone: venue.contact_phone ?? null,
                    slot_number: slot.slot_number,
                    floor_level: slot.floor_level ?? null,
                    zone: slot.zone ?? null,
                    customer_id: resolvedCustomerId,
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    magic_token: magicToken,
                    valet_staff_id: staff.id,
                    valet_staff_name: staff.full_name,
                    vehicle: {
                        id: vehicleId,
                        license_plate: plate,
                        vehicle_type: vehicle_type || 'car',
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
                        address: venue.address ?? null,
                        phone: venue.contact_phone ?? null,
                    },
                    staff: staff.id
                        ? { id: staff.id, name: staff.full_name }
                        : null,
                    customer: resolvedCustomerId
                        ? {
                            id: resolvedCustomerId,
                            name: customerName,
                            phone: customerPhone,
                        }
                        : null,
                    pricing: pricingMeta,
                    pricing_metadata: pricingMeta,
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
