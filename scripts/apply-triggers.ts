import pool from '../lib/db';
import fs from 'fs';

async function applyTriggers() {
    const sql = fs.readFileSync('/tmp/realtime_triggers.sql', 'utf8');
    const client = await pool.connect();
    try {
        await client.query(sql);
        console.log('✓ Realtime triggers applied successfully');
    } catch (err) {
        console.error('✗ Failed to apply triggers:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

applyTriggers();
