import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * GET /api/sessions/checkout/search?q=<phone_or_plate>
 *
 * Staff lookup: find active parking session(s) by customer phone number or license plate.
 * Returns up to 5 matches with estimated billing info so staff can preview before checkout.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q')?.trim();

        if (!q) {
            return NextResponse.json(
                { error: 'q (phone or plate) is required' },
                { status: 400 }
            );
        }

        // Normalise query: uppercase, strip spaces
        const normalizedQ = q.toUpperCase().replace(/\s+/g, '');

        const result = await pool.query(
            `SELECT
                ps.id,
                ps.entry_time,
                ps.rate_per_hour,
                ps.retrieval_status,
                ps.sms_code,
                v.license_plate,
                v.make,
                v.model,
                v.color,
                v.vehicle_type,
                sl.slot_number,
                sl.floor_level,
                sl.zone,
                ve.name       AS venue_name,
                cu.id         AS customer_id,
                cu.full_name  AS customer_name,
                cu.phone      AS customer_phone,
                EXTRACT(EPOCH FROM (NOW() - ps.entry_time)) / 3600 AS duration_hours
             FROM parking_sessions ps
             JOIN vehicles v       ON v.id  = ps.vehicle_id
             LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
             LEFT JOIN venues ve   ON ve.id = ps.venue_id
             LEFT JOIN users cu    ON cu.id = ps.customer_id
             WHERE ps.status = 'active'
               AND (
                 UPPER(REPLACE(v.license_plate, ' ', '')) = $1
                 OR cu.phone = $2
                 OR UPPER(ps.sms_code) = $1
               )
             ORDER BY ps.entry_time DESC
             LIMIT 5`,
            [normalizedQ, q]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ found: false, sessions: [] });
        }

        const sessions = result.rows.map((row) => {
            const durationHours = Number(row.duration_hours) || 0;
            const h = Math.floor(durationHours);
            const m = Math.round((durationHours - h) * 60);
            const durationDisplay = h > 0 ? `${h}h ${m}m` : `${m}m`;
            const billedHours = Math.max(Math.ceil(durationHours), 1);
            const estimatedAmount = billedHours * (Number(row.rate_per_hour) || 100);

            return {
                id: row.id,
                entry_time: row.entry_time,
                rate_per_hour: Number(row.rate_per_hour),
                retrieval_status: row.retrieval_status || null,
                sms_code: row.sms_code || null,
                duration: durationDisplay,
                duration_hours: Number(durationHours.toFixed(2)),
                billed_hours: billedHours,
                estimated_amount: estimatedAmount,
                vehicle: {
                    license_plate: row.license_plate,
                    make: row.make,
                    model: row.model,
                    color: row.color,
                    vehicle_type: row.vehicle_type,
                },
                slot: {
                    slot_number: row.slot_number,
                    floor_level: row.floor_level,
                    zone: row.zone,
                },
                venue: { name: row.venue_name },
                customer: {
                    id: row.customer_id,
                    name: row.customer_name,
                    phone: row.customer_phone,
                },
            };
        });

        return NextResponse.json({ found: true, sessions });
    } catch (error) {
        console.error('Checkout search error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
