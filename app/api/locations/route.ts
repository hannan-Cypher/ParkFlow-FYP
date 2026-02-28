import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET /api/locations - Fetch all locations
export async function GET() {
    try {
        const result = await pool.query(`
      SELECT 
        id,
        name,
        address,
        city,
        country,
        total_slots,
        gates,
        contact_phone,
        contact_email,
        status,
        created_at,
        updated_at
      FROM venues
      ORDER BY created_at DESC
    `);

        return NextResponse.json({ locations: result.rows }, { status: 200 });
    } catch (error) {
        console.error('Error fetching locations:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST /api/locations - Create a new location
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            name,
            address,
            city,
            country = 'Pakistan',
            total_slots,
            gates,
            contact_phone,
            contact_email,
            status = 'active',
        } = body;

        // Validation
        if (!name || !address || !city || total_slots === undefined || gates === undefined) {
            return NextResponse.json(
                { error: 'Name, address, city, total_slots, and gates are required' },
                { status: 400 }
            );
        }

        if (Number(total_slots) < 0 || Number(gates) < 0) {
            return NextResponse.json(
                { error: 'total_slots and gates must be non-negative numbers' },
                { status: 400 }
            );
        }

        const result = await pool.query(
            `INSERT INTO venues (name, address, city, country, total_slots, gates, contact_phone, contact_email, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, name, address, city, country, total_slots, gates, contact_phone, contact_email, status, created_at, updated_at`,
            [name, address, city, country, Number(total_slots), Number(gates), contact_phone || null, contact_email || null, status]
        );

        return NextResponse.json({ location: result.rows[0] }, { status: 201 });
    } catch (error) {
        console.error('Error creating location:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
