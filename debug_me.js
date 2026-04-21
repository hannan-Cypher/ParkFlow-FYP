const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function debugMe() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    const userEmail = 'ali.hassan@parkflowpk.com';

    console.log('--- DEBUG ME API ---');

    try {
        const result = await pool.query(`
          SELECT 
            u.id,
            u.full_name,
            u.email,
            u.phone,
            u.role,
            u.venue_id
          FROM users u
          WHERE u.email = $1`, [userEmail]);

        console.log('Result:', result.rows[0]);
    } catch (err) {
        console.error('Query error:', err);
    } finally {
        await pool.end();
    }
}

debugMe();
