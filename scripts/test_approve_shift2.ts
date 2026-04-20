import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://Owner:152147296110%40Hm@localhost:5432/valet_parking'
});

async function main() {
  const result = await pool.query(
    `SELECT u.id, u.role, u.email, s.token, s.expires_at FROM users u
     INNER JOIN sessions s ON u.id = s.user_id
     WHERE s.expires_at > NOW()
     ORDER BY s.expires_at DESC
     LIMIT 1`
  );
  if (result.rows.length === 0) {
    console.log('No active session found');
    return;
  }
  const session = result.rows[0];
  console.log('Role:', session.role, 'Email:', session.email);

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
