import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

/**
 * GET /api/customers/lookup?phone=xxx
 *
 * Look up a customer by phone number.
 * Returns customer profile + vehicle history if found.
 * Used by staff during check-in to identify returning customers.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const phone = searchParams.get('phone')?.trim()

        if (!phone) {
            return NextResponse.json({ error: 'phone is required' }, { status: 400 })
        }

        const result = await pool.query(
            `SELECT
                u.id,
                u.full_name,
                u.email,
                u.phone,
                COUNT(ps.id) AS session_count,
                MAX(ps.entry_time) AS last_visit
             FROM users u
             LEFT JOIN parking_sessions ps ON ps.customer_id = u.id
             WHERE u.phone = $1 AND u.role = 'customer'
             GROUP BY u.id, u.full_name, u.email, u.phone`,
            [phone]
        )

        if (result.rows.length === 0) {
            return NextResponse.json({ found: false })
        }

        const customer = result.rows[0]

        // Fetch vehicles owned by this customer
        const vehiclesResult = await pool.query(
            `SELECT id, license_plate, make, model, color, vehicle_type, is_primary
             FROM vehicles
             WHERE owner_id = $1
             ORDER BY is_primary DESC NULLS LAST, created_at DESC`,
            [customer.id]
        )

        return NextResponse.json({
            found: true,
            customer: {
                id: customer.id,
                full_name: customer.full_name,
                email: customer.email,
                phone: customer.phone,
                session_count: Number(customer.session_count),
                last_visit: customer.last_visit,
                vehicles: vehiclesResult.rows,
            },
        })
    } catch (error) {
        console.error('Customer lookup error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
