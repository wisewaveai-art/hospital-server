const { Client } = require('pg');
const dns = require('dns');
const dotenv = require('dotenv');

// Manual DNS lookup patch to bypass local DNS ENOTFOUND for Supabase
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (hostname === 'db.ihxgsyrkxrnghsxqlxpp.supabase.co' || hostname === 'ihxgsyrkxrnghsxqlxpp.supabase.co') {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'object' ? options : {};
    
    if (opts.all) {
      return cb(null, [{ address: '104.18.38.10', family: 4 }]);
    }
    return cb(null, '104.18.38.10', 4);
  }
  return originalLookup(hostname, options, callback);
};

dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL.replace('db.ihxgsyrkxrnghsxqlxpp.supabase.co', '104.18.38.10'),
});

// Note: Using the IP directly in connection string might not work for SSL/SNI, 
// but the dns.lookup patch SHOULD handle it if we use the hostname.

async function run() {
  const client2 = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  await client2.connect();
  try {
    const res = await client2.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    console.log('Tables:', res.rows.map(r => r.tablename));
    
    const usersCols = await client2.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('Users Columns:', usersCols.rows.map(r => r.column_name));
    
  } catch (err) {
    console.error('PG Error:', err.message);
  } finally {
    await client2.end();
  }
}

run();
