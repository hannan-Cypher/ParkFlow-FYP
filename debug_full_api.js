const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function debugFullApi() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    const supervisorId = '39ec01c9-43c1-40b6-bc2d-c86dd98d4efd'; // Ali Hassan

    console.log('--- DEBUG FULL API ---');

    try {
        // 1. Get the supervisor info
        const callerRes = await pool.query('SELECT role, venue_id FROM users WHERE id = $1', [supervisorId]);
        const caller = callerRes.rows[0];
        console.log('Caller:', caller);

        // 2. Prepare the query
        let venueFilter = '';
        const params = [];
        if (caller.role === 'supervisor') {
            if (caller.venue_id) {
                venueFilter = 'AND u.venue_id = $1';
                params.push(caller.venue_id);
            } else {
                console.log('Supervisor has no venue_id');
                process.exit(0);
            }
        }

        const sql = `
          SELECT
            u.id, u.email, u.full_name, u.phone, u.role, u.status, u.created_at,
            u.venue_id, av.name as venue_name,
            u.zone_id, az.name as zone_name,
            si.created_at as invited_at,
            inviter.full_name as invited_by_name,
            CASE WHEN ss.id IS NOT NULL THEN true ELSE false END AS on_duty
          FROM users u
          LEFT JOIN venues av ON u.venue_id = av.id
          LEFT JOIN zones az ON u.zone_id = az.id
          LEFT JOIN (
            SELECT DISTINCT ON (email) email, invited_by, created_at
            FROM staff_invitations
            ORDER BY email, created_at DESC
          ) si ON u.email = si.email
          LEFT JOIN users inviter ON si.invited_by = inviter.id
          LEFT JOIN LATERAL (
            SELECT id FROM staff_shifts
            WHERE staff_id = u.id AND status IN ('active', 'on_break')
            LIMIT 1
          ) ss ON true
          WHERE u.role IN ('driver', 'washer', 'supervisor')
          ${venueFilter}
          ORDER BY u.created_at DESC
        `;

        console.log('Running query with params:', params);
        const result = await pool.query(sql, params);

        console.log(`Found ${result.rows.length} staff members`);

        if (result.rows.length > 0) {
            console.log('First member:', result.rows[0]);
        }
    } catch (err) {
        console.error('Query error:', err);
    } finally {
        await pool.end();
    }
}

debugFullApi();
