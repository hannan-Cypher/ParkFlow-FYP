import { Pool } from 'pg';
import { isAdminLike } from '../lib/roles';

const pool = new Pool({
  connectionString: 'postgresql://Owner:152147296110%40Hm@localhost:5432/valet_parking'
});

async function main() {
  const result = await pool.query(
    `SELECT u.id, u.role, s.token, s.expires_at FROM users u
     INNER JOIN sessions s ON u.id = s.user_id
     WHERE u.role = 'supervisor' AND s.expires_at > NOW()
     LIMIT 1`
  );
  if (result.rows.length === 0) {
    console.log('No active admin session found');
    return;
  }
  const session = result.rows[0];
  console.log('Role:', session.role);
  console.log('isAdminLike:', isAdminLike(session.role));

  // Now hit the API
  const res = await fetch('http://localhost:3000/api/admin/approve-shift', {
    headers: {
      cookie: `auth_token=${session.token}`
    }
  });

  console.log('API Status:', res.status);
  console.log('API Body:', await res.text());
  process.exit(0);
}
main().catch(console.error);
