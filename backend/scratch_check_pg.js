const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await client.connect();
  try {
    const res = await client.query('SELECT email, role, organization_id FROM users');
    console.log('Users in DB (Direct PG):', res.rows);
  } catch (err) {
    console.error('PG Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
