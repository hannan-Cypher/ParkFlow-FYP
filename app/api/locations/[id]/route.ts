import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


// ── Zone Auto-Naming Algorithm ─────────────────────────────────────────────
function generateZonePrefix(gateName: string): string {
    const words = gateName.trim().split(/\s+/);
    if (words.length > 1) {
        return words.map(w => w[0]).join('').toUpperCase();
    }
    return gateName.trim().substring(0, 2).toUpperCase();
}

// Types
interface GateZonePayload {
    name: string;
    zones: { slots: number; is_vip?: boolean }[];
}

// PUT /api/locations/[id] - Update a location with full gate/zone/slot rebuild
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const client = await pool.connect();
    try {
        const { id } = await params;
        const body = await request.json();
        const {
            name,
            address,
            city,
            country,
            contact_phone,
            contact_email,
            status,
            gates: gatesPayload,
            shift_start_time,
            shift_end_time,
            max_break_minutes,
            enforce_shift_start_window,
            vip_base_rate_per_hour,
            vip_high_occupancy_multiplier,
            vip_critical_occupancy_multiplier,
        } = body;

        // ... Validation omitted for brevity ...

        // ── Calculate totals ───────────────────────────────────────────────
        const totalGates = gatesPayload.length;
        let totalSlots = 0;
        for (const gate of gatesPayload as GateZonePayload[]) {
            for (const zone of gate.zones) {
                totalSlots += zone.slots;
            }
        }

        await client.query('BEGIN');

        // Check venue exists
        const checkResult = await client.query('SELECT id FROM venues WHERE id = $1', [id]);
        if (checkResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        // 1. Update venue basic info (including shift and VIP pricing config)
        const venueResult = await client.query(
            `UPDATE venues
             SET name = $1, address = $2, city = $3, country = $4, total_slots = $5,
                 gates = $6, contact_phone = $7, contact_email = $8, status = $9,
                 shift_start_time           = COALESCE($10, shift_start_time),
                 shift_end_time             = COALESCE($11, shift_end_time),
                 max_break_minutes          = COALESCE($12, max_break_minutes),
                 enforce_shift_start_window = COALESCE($13, enforce_shift_start_window),
                 vip_base_rate_per_hour          = COALESCE($14, vip_base_rate_per_hour),
                 vip_high_occupancy_multiplier   = COALESCE($15, vip_high_occupancy_multiplier),
                 vip_critical_occupancy_multiplier = COALESCE($16, vip_critical_occupancy_multiplier),
                 updated_at = NOW()
             WHERE id = $17
             RETURNING *`,
            [
                name, address, city, country || 'Pakistan', totalSlots, totalGates,
                contact_phone || null, contact_email || null, status || 'active',
                shift_start_time || null, shift_end_time || null,
                max_break_minutes != null ? parseInt(max_break_minutes, 10) : null,
                enforce_shift_start_window != null ? Boolean(enforce_shift_start_window) : null,
                vip_base_rate_per_hour != null ? Number(vip_base_rate_per_hour) : null,
                vip_high_occupancy_multiplier != null ? Number(vip_high_occupancy_multiplier) : null,
                vip_critical_occupancy_multiplier != null ? Number(vip_critical_occupancy_multiplier) : null,
                id,
            ]
        );
        const venue = venueResult.rows[0];

        // ... Guard against destructive slot rebuild omitted for brevity ...

        // 2. Delete old parking_slots, zones, and gates (cascading via FK)
        await client.query('DELETE FROM parking_slots WHERE venue_id = $1', [id]);
        await client.query('DELETE FROM zones WHERE venue_id = $1', [id]);
        await client.query('DELETE FROM gates WHERE venue_id = $1', [id]);

        // 3. Re-create gates, zones, and slots
        const createdGates = [];
        const usedPrefixes: Record<string, number> = {};

        for (let gi = 0; gi < (gatesPayload as GateZonePayload[]).length; gi++) {
            const gateData = (gatesPayload as GateZonePayload[])[gi];

            const gateResult = await client.query(
                `INSERT INTO gates (venue_id, name, display_order)
                 VALUES ($1, $2, $3)
                 RETURNING id, name, display_order`,
                [venue.id, gateData.name.trim(), gi]
            );
            const gate = gateResult.rows[0];

            let zonePrefix = generateZonePrefix(gateData.name);
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

                const zoneResult = await client.query(
                    `INSERT INTO zones (gate_id, venue_id, name, total_slots, is_vip)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id, name, total_slots, is_vip`,
                    [gate.id, venue.id, zoneName, zoneData.slots, isVip]
                );
                const zone = zoneResult.rows[0];

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
            { status: 200 }
        );
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating location:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    } finally {
        client.release();
    }
}

// DELETE /api/locations/[id] - Delete a location (cascades to gates, zones, slots)
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const result = await pool.query(
            'DELETE FROM venues WHERE id = $1 RETURNING id, name',
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        return NextResponse.json(
            { message: `Location "${result.rows[0].name}" deleted successfully` },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error deleting location:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
