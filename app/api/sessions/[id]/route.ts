import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';


/**
 * GET /api/sessions/[id]
 *
 * Get full details of a single parking session by its UUID.
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const result = await pool.query(
            `SELECT
         ps.id,
         ps.status,
         ps.entry_time,
         ps.exit_time,
         ps.rate_per_hour,
         ps.total_hours,
         ps.total_amount,
         ps.payment_status,
         ps.entry_plate_confidence,
         ps.exit_plate_confidence,
         ps.entry_image_url,
         ps.exit_image_url,
         ps.qr_code,
         ps.sms_code,
         ps.customer_notes,
         ps.staff_notes,
         v.id             AS vehicle_id,
         v.license_plate,
         v.make,
         v.model,
         v.color,
         v.year           AS vehicle_year,
         v.vehicle_type,
         sl.id            AS slot_id,
         sl.slot_number,
         sl.floor_level,
         sl.zone,
         sl.slot_type,
         ve.id            AS venue_id,
         ve.name          AS venue_name,
         ve.address       AS venue_address,
         ve.city          AS venue_city,
         staff.id         AS staff_id,
         staff.full_name  AS staff_name,
         staff.phone      AS staff_phone,
         cust.id          AS customer_id,
         cust.full_name   AS customer_name,
         cust.phone       AS customer_phone,
         cust.email       AS customer_email
       FROM parking_sessions ps
       JOIN vehicles v       ON v.id  = ps.vehicle_id
       LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
       LEFT JOIN venues ve   ON ve.id = ps.venue_id
       LEFT JOIN users staff ON staff.id = ps.valet_staff_id
       LEFT JOIN users cust  ON cust.id  = ps.customer_id
       WHERE ps.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const row = result.rows[0];

        // Live duration for active sessions
        let duration = null;
        if (row.status === 'active') {
            const ms = Date.now() - new Date(row.entry_time).getTime();
            const h = Math.floor(ms / 3600000);
            const m = Math.round((ms % 3600000) / 60000);
            duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        } else if (row.total_hours) {
            const h = Math.floor(Number(row.total_hours));
            const m = Math.round((Number(row.total_hours) - h) * 60);
            duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
        }

        return NextResponse.json(
            {
                session: {
                    id: row.id,
                    status: row.status,
                    entry_time: row.entry_time,
                    exit_time: row.exit_time,
                    duration,
                    rate_per_hour: Number(row.rate_per_hour),
                    total_hours: row.total_hours ? Number(row.total_hours) : null,
                    total_amount: row.total_amount ? Number(row.total_amount) : null,
                    payment_status: row.payment_status,
                    entry_plate_confidence: row.entry_plate_confidence
                        ? Number(row.entry_plate_confidence)
                        : null,
                    exit_plate_confidence: row.exit_plate_confidence
                        ? Number(row.exit_plate_confidence)
                        : null,
                    entry_image_url: row.entry_image_url,
                    exit_image_url: row.exit_image_url,
                    qr_code: row.qr_code,
                    sms_code: row.sms_code,
                    customer_notes: row.customer_notes,
                    staff_notes: row.staff_notes,
                    vehicle: {
                        id: row.vehicle_id,
                        license_plate: row.license_plate,
                        make: row.make,
                        model: row.model,
                        color: row.color,
                        year: row.vehicle_year,
                        vehicle_type: row.vehicle_type,
                    },
                    slot: row.slot_id
                        ? {
                            id: row.slot_id,
                            slot_number: row.slot_number,
                            floor_level: row.floor_level,
                            zone: row.zone,
                            slot_type: row.slot_type,
                        }
                        : null,
                    venue: {
                        id: row.venue_id,
                        name: row.venue_name,
                        address: row.venue_address,
                        city: row.venue_city,
                    },
                    staff: row.staff_id
                        ? {
                            id: row.staff_id,
                            name: row.staff_name,
                            phone: row.staff_phone,
                        }
                        : null,
                    customer: row.customer_id
                        ? {
                            id: row.customer_id,
                            name: row.customer_name,
                            phone: row.customer_phone,
                            email: row.customer_email,
                        }
                        : null,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Get session error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
