import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


// ── Zone Auto-Naming Algorithm ─────────────────────────────────────────────
// Multi-word gate name: first letter of each word → "Food Court" → "FC"
// Single-word gate name: first two letters → "Cinema" → "CI"
function generateZonePrefix(gateName: string): string {
    const words = gateName.trim().split(/\s+/);
    if (words.length > 1) {
        return words.map(w => w[0]).join('').toUpperCase();
    }
    return gateName.trim().substring(0, 2).toUpperCase();
}

// ── Types for the hierarchical payload ─────────────────────────────────────
// ── Types for the hierarchical payload ─────────────────────────────────────
interface GateZonePayload {
    name: string;
    zones: { slots: number; is_vip?: boolean }[];
}

export async function GET() {
    try {
        const result = await pool.query(`
            SELECT
                id, name, address, city, country, total_slots, gates,
                contact_phone, contact_email, status,
                shift_start_time::text, shift_end_time::text, max_break_minutes,
                enforce_shift_start_window,
                vip_base_rate_per_hour, vip_high_occupancy_multiplier, vip_critical_occupancy_multiplier,
                created_at, updated_at
            FROM venues
            ORDER BY name ASC
        `);

        return NextResponse.json({
            success: true,
            locations: result.rows,
            total: result.rowCount
        });
    } catch (error) {
        console.error('Error fetching locations:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/locations - Create a new location with gates → zones → slots
export async function POST(request: NextRequest) {
    const client = await pool.connect();
    try {
        const body = await request.json();
        const {
            name,
            address,
            city,
            country = 'Pakistan',
            contact_phone,
            contact_email,
            status = 'active',
            gates: gatesPayload,
            shift_start_time = '09:00',
            shift_end_time = '18:00',
            max_break_minutes = 30,
            enforce_shift_start_window = true,
            vip_base_rate_per_hour,
            vip_high_occupancy_multiplier = 1.5,
            vip_critical_occupancy_multiplier = 2.0,
        } = body;

        // ── Validation omitted for brevity ...

        // ── Calculate totals ───────────────────────────────────────────────
        const totalGates = gatesPayload.length;
        let totalSlots = 0;
        for (const gate of gatesPayload as GateZonePayload[]) {
            for (const zone of gate.zones) {
                totalSlots += zone.slots;
            }
        }

        // ── Begin transaction ──────────────────────────────────────────────
        await client.query('BEGIN');

        // 1. Insert venue
        const venueResult = await client.query(
            `INSERT INTO venues (name, address, city, country, total_slots, gates, contact_phone, contact_email, status,
                                 shift_start_time, shift_end_time, max_break_minutes, enforce_shift_start_window,
                                 vip_base_rate_per_hour, vip_high_occupancy_multiplier, vip_critical_occupancy_multiplier)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING id, name, address, city, country, total_slots, gates, contact_phone, contact_email, status,
                       shift_start_time::text, shift_end_time::text, max_break_minutes, enforce_shift_start_window,
                       vip_base_rate_per_hour, vip_high_occupancy_multiplier, vip_critical_occupancy_multiplier,
                       created_at, updated_at`,
            [name, address, city, country, totalSlots, totalGates, contact_phone || null, contact_email || null, status,
                shift_start_time, shift_end_time, Number(max_break_minutes), Boolean(enforce_shift_start_window),
                vip_base_rate_per_hour || null, vip_high_occupancy_multiplier, vip_critical_occupancy_multiplier]
        );
        const venue = venueResult.rows[0];

        // 2. Insert gates, zones, and parking slots
        const createdGates = [];
        // Track used zone prefixes to handle duplicates
        const usedPrefixes: Record<string, number> = {};

        for (let gi = 0; gi < (gatesPayload as GateZonePayload[]).length; gi++) {
            const gateData = (gatesPayload as GateZonePayload[])[gi];

            // Insert gate
            const gateResult = await client.query(
                `INSERT INTO gates (venue_id, name, display_order)
                 VALUES ($1, $2, $3)
                 RETURNING id, name, display_order`,
                [venue.id, gateData.name.trim(), gi]
            );
            const gate = gateResult.rows[0];

            // Generate zone prefix from gate name
            let zonePrefix = generateZonePrefix(gateData.name);

            // Handle duplicate prefixes
            if (usedPrefixes[zonePrefix] !== undefined) {
                usedPrefixes[zonePrefix]++;
                zonePrefix = zonePrefix + usedPrefixes[zonePrefix];
            } else {
                usedPrefixes[zonePrefix] = 0;
            }

            const createdZones = [];

            for (let zi = 0; zi < gateData.zones.length; zi++) {
                const zoneData = gateData.zones[zi];
                const zoneName = `${zonePrefix}${zi + 1}`;
                const isVip = !!zoneData.is_vip;

                // Insert zone
                const zoneResult = await client.query(
                    `INSERT INTO zones (gate_id, venue_id, name, total_slots, is_vip)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, name, total_slots, is_vip`,
                    [gate.id, venue.id, zoneName, zoneData.slots, isVip]
                );
                const zone = zoneResult.rows[0];

                // Insert parking slots for this zone
                for (let si = 1; si <= zoneData.slots; si++) {
                    const slotNumber = `${zoneName}-${String(si).padStart(3, '0')}`;
                    await client.query(
                        `INSERT INTO parking_slots (venue_id, slot_number, zone, zone_id, gate_id, slot_type, status)
                         VALUES ($1, $2, $3, $4, $5, $6, 'available')`,
                        [venue.id, slotNumber, zoneName, zone.id, gate.id, isVip ? 'vip' : 'standard']
                    );
                }

                createdZones.push({
                    id: zone.id,
                    name: zone.name,
                    total_slots: zone.total_slots,
                    is_vip: zone.is_vip,
                });
            }

            createdGates.push({
                id: gate.id,
                name: gate.name,
                display_order: gate.display_order,
                zones: createdZones,
            });
        }

        // ── Commit ─────────────────────────────────────────────────────────
        await client.query('COMMIT');

        return NextResponse.json(
            {
                location: {
                    ...venue,
                    gate_count: totalGates,
                    zone_count: createdGates.reduce((acc, g) => acc + g.zones.length, 0),
                },
                gates: createdGates,
            },
            { status: 201 }
        );
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating location:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    } finally {
        client.release();
    }
}
