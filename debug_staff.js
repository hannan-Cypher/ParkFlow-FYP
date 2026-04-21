const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function debugStaff() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    const venueId = '11111111-1111-1111-1111-111111111111'; // Centaurus Mall

    console.log('--- DEBUG STAFF ---');
    console.log('Using DATABASE_URL:', process.env.DATABASE_URL);

    try {
        const result = await pool.query(`
          SELECT
            u.id, u.email, u.full_name, u.phone, u.role, u.status, u.created_at,
            u.venue_id, av.name as venue_name,
            u.zone_id, az.name as zone_name
          FROM users u
          LEFT JOIN venues av ON u.venue_id = av.id
          LEFT JOIN zones az ON u.zone_id = az.id
          WHERE u.role IN ('driver', 'washer', 'supervisor')
          AND u.venue_id = $1
          ORDER BY u.created_at DESC
        `, [venueId]);

        console.log(`Found ${result.rows.length} staff members for venue ${venueId}`);

        if (result.rows.length > 0) {
            console.log('First member:', JSON.stringify(result.rows[0], null, 2));
        }
    } catch (err) {
        console.error('Query error:', err);
    } finally {
        await pool.end();
    }
}

debugStaff();
