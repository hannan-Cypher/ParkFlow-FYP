import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic';

function escapeCSV(field: any): string {
    if (field === null || field === undefined) {
        return '';
    }
    const str = String(field);
    if (str.includes(',') || str.includes('\"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

export async function GET(request: NextRequest) {
    try {
        const query = `
            SELECT 
                v.license_plate, v.make AS vehicle_make, v.model AS vehicle_model, v.color AS vehicle_color,
                cu.full_name AS owner_name, cu.phone AS owner_phone_number,
                ve.name AS venue_name, z.name AS zone_name, sl.slot_number,
                in_staff.full_name AS check_in_staff_name,
                out_staff.full_name AS check_out_staff_name,
                ps.entry_time, ps.exit_time, ps.total_hours,
                ps.rate_per_hour, ps.total_amount, ps.payment_status,
                sr.service_status AS wash_status, sr.wash_type,
                ps.status AS session_status, ps.requested_class, ps.retrieval_status,
                ps.customer_notes, ps.staff_notes, ps.damage_notes, 
                ps.rating, ps.rating_comment,
                (SELECT COALESCE(SUM(s_inner.service_cost), 0) FROM service_requests s_inner WHERE s_inner.session_id = ps.id AND s_inner.service_type = 'wash' AND s_inner.service_status = 'completed') as wash_amount
            FROM parking_sessions ps
            LEFT JOIN vehicles v ON v.id = ps.vehicle_id
            LEFT JOIN users cu ON cu.id = ps.customer_id
            LEFT JOIN users in_staff ON in_staff.id = ps.valet_staff_id
            LEFT JOIN users out_staff ON out_staff.id = ps.retrieval_staff_id
            LEFT JOIN venues ve ON ve.id = ps.venue_id
            LEFT JOIN parking_slots sl ON sl.id = ps.slot_id
            LEFT JOIN zones z ON z.id = sl.zone_id
            LEFT JOIN service_requests sr ON sr.session_id = ps.id AND sr.service_type = 'wash' AND sr.service_status = 'completed'
            ORDER BY ps.created_at DESC
        `;
        const { rows } = await pool.query(query);

        const headers = [
            'Plate Number', 'Vehicle Make', 'Vehicle Model', 'Vehicle Color',
            'Owner Name', 'Owner Phone Number',
            'Venue Name', 'Zone Name', 'Slot Number',
            'Check-In Staff Name', 'Check-Out Staff Name',
            'Check-In Time', 'Check-Out Time', 'Total Hours Parked',
            'Rate per Hour', 'Parking Amount', 'Wash Amount', 'Total Amount Charged', 'Payment Status',
            'Washes Included', 'Wash Status', 'Type of Washes',
            'Session Status', 'Requested Class', 'Retrieval Status',
            'Customer Notes', 'Staff Notes', 'Damage Notes', 'Rating', 'Rating Comment'
        ];

        let csvContent = headers.join(',') + '\n';

        for (const row of rows) {
            const washAmount = Number(row.wash_amount) || 0;
            const totalAmount = Number(row.total_amount) || 0;
            const parkingAmount = Math.max(totalAmount - washAmount, 0);

            const line = [
                row.license_plate, row.vehicle_make, row.vehicle_model, row.vehicle_color,
                row.owner_name, row.owner_phone_number,
                row.venue_name, row.zone_name, row.slot_number,
                row.check_in_staff_name, row.check_out_staff_name,
                row.entry_time ? new Date(row.entry_time).toLocaleString() : '',
                row.exit_time ? new Date(row.exit_time).toLocaleString() : '',
                row.total_hours,
                row.rate_per_hour, parkingAmount, washAmount, totalAmount, row.payment_status,
                row.wash_status ? 'Yes' : 'No', row.wash_status, row.wash_type,
                row.session_status, row.requested_class, row.retrieval_status,
                row.customer_notes, row.staff_notes, row.damage_notes,
                row.rating, row.rating_comment
            ];

            csvContent += line.map(escapeCSV).join(',') + '\n';
        }

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="parkflow_sales_export.csv"'
            },
        });
    } catch (error) {
        console.error('Export sales error:', error);
        return NextResponse.json(
            { error: 'Internal server error while exporting sales' },
            { status: 500 }
        );
    }
}
