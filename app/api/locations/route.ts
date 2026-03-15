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
interface GateZonePayload {
    name: string;
    zones: { slots: number }[];
}

// GET /api/locations - Fetch all locations with gate/zone counts
export async function GET() {
    try {
        const result = await pool.query(`
      SELECT 
        v.id,
        v.name,
        v.address,
        v.city,
        v.country,
        v.total_slots,
        v.gates,
        v.contact_phone,
        v.contact_email,
        v.status,
        v.created_at,
        v.updated_at,
        (SELECT COUNT(*) FROM gates g WHERE g.venue_id = v.id)::int AS gate_count,
        (SELECT COUNT(*) FROM zones z WHERE z.venue_id = v.id)::int AS zone_count
      FROM venues v
      ORDER BY v.created_at DESC
    `);

        return NextResponse.json({ locations: result.rows }, { status: 200 });
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
        } = body;

        // ── Validation ─────────────────────────────────────────────────────
        if (!name || !address || !city) {
            return NextResponse.json(
                { error: 'Name, address, and city are required' },
                { status: 400 }
            );
        }

        if (!gatesPayload || !Array.isArray(gatesPayload) || gatesPayload.length === 0) {
            return NextResponse.json(
                { error: 'At least one gate is required' },
                { status: 400 }
            );
        }

        // Validate each gate
        for (const gate of gatesPayload as GateZonePayload[]) {
            if (!gate.name || !gate.name.trim()) {
                return NextResponse.json(
                    { error: 'Each gate must have a name' },
                    { status: 400 }
                );
            }
            if (!gate.zones || !Array.isArray(gate.zones) || gate.zones.length === 0) {
                return NextResponse.json(
                    { error: `Gate "${gate.name}" must have at least one zone` },
                    { status: 400 }
                );
            }
            for (const zone of gate.zones) {
                if (!zone.slots || zone.slots < 1) {
                    return NextResponse.json(
                        { error: `Each zone in gate "${gate.name}" must have at least 1 slot` },
                        { status: 400 }
                    );
                }
            }
        }

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
            `INSERT INTO venues (name, address, city, country, total_slots, gates, contact_phone, contact_email, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, name, address, city, country, total_slots, gates, contact_phone, contact_email, status, created_at, updated_at`,
            [name, address, city, country, totalSlots, totalGates, contact_phone || null, contact_email || null, status]
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

            // Handle duplicate prefixes (e.g., two gates "Food Court" and "Fashion Center" both → "FC")
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

                // Insert zone
                const zoneResult = await client.query(
                    `INSERT INTO zones (gate_id, venue_id, name, total_slots)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id, name, total_slots`,
                    [gate.id, venue.id, zoneName, zoneData.slots]
                );
                const zone = zoneResult.rows[0];

                // Insert parking slots for this zone
                for (let si = 1; si <= zoneData.slots; si++) {
                    const slotNumber = `${zoneName}-${String(si).padStart(3, '0')}`;
                    await client.query(
                        `INSERT INTO parking_slots (venue_id, slot_number, zone, zone_id, gate_id, slot_type, status)
                         VALUES ($1, $2, $3, $4, $5, 'standard', 'available')`,
                        [venue.id, slotNumber, zoneName, zone.id, gate.id]
                    );
                }

                createdZones.push({
                    id: zone.id,
                    name: zone.name,
                    total_slots: zone.total_slots,
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
