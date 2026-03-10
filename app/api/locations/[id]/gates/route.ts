import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/locations/[id]/gates - Get full gate → zone hierarchy for a venue
export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        // Check venue exists
        const venueResult = await pool.query(
            'SELECT id, name FROM venues WHERE id = $1',
            [id]
        );
        if (venueResult.rows.length === 0) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        // Get all gates for this venue
        const gatesResult = await pool.query(
            `SELECT id, name, display_order FROM gates WHERE venue_id = $1 ORDER BY display_order ASC`,
            [id]
        );

        // Get all zones with slot counts
        const zonesResult = await pool.query(
            `SELECT 
                z.id, z.name, z.total_slots, z.gate_id,
                COUNT(ps.id) FILTER (WHERE ps.status = 'available')::int AS available_slots,
                COUNT(ps.id) FILTER (WHERE ps.status = 'occupied')::int AS occupied_slots
             FROM zones z
             LEFT JOIN parking_slots ps ON ps.zone_id = z.id
             WHERE z.venue_id = $1
             GROUP BY z.id, z.name, z.total_slots, z.gate_id
             ORDER BY z.name ASC`,
            [id]
        );

        // Build hierarchy
        const gates = gatesResult.rows.map(gate => ({
            id: gate.id,
            name: gate.name,
            display_order: gate.display_order,
            zones: zonesResult.rows
                .filter(z => z.gate_id === gate.id)
                .map(z => ({
                    id: z.id,
                    name: z.name,
                    total_slots: z.total_slots,
                    available_slots: z.available_slots,
                    occupied_slots: z.occupied_slots,
                })),
        }));

        return NextResponse.json({ gates }, { status: 200 });
    } catch (error) {
        console.error('Error fetching gates:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
