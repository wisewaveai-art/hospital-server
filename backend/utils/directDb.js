const { Pool } = require('pg');

// Direct DB connection for critical queries that bypass Supabase PostgREST cache issues
const pool = new Pool({
    connectionString: process.env.DATABASE_URL?.replace('db.ihxgsyrkxrnghsxqlxpp.supabase.co', '13.232.227.185'),
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle pg client', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
