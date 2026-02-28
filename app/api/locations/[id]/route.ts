import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// PUT /api/locations/[id] - Update a location
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const body = await request.json();
        const {
            name,
            address,
            city,
            country,
            total_slots,
            gates,
            contact_phone,
            contact_email,
            status,
        } = body;

        if (!name || !address || !city || total_slots === undefined || gates === undefined) {
            return NextResponse.json(
                { error: 'Name, address, city, total_slots, and gates are required' },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `UPDATE venues
       SET name = $1, address = $2, city = $3, country = $4, total_slots = $5,
           gates = $6, contact_phone = $7, contact_email = $8, status = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING id, name, address, city, country, total_slots, gates, contact_phone, contact_email, status, created_at, updated_at`,
            [
                name,
                address,
                city,
                country || 'Pakistan',
                Number(total_slots),
                Number(gates),
                contact_phone || null,
                contact_email || null,
                status || 'active',
                id,
            ]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ error: 'Location not found' }, { status: 404 });
        }

        return NextResponse.json({ location: result.rows[0] }, { status: 200 });
    } catch (error) {
        console.error('Error updating location:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/locations/[id] - Delete a location
export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

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
