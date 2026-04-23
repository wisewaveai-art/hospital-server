require('dotenv').config();
const mysql = require('mysql2/promise');

function getEnv(key, fallback = '') {
  const val = process.env[key];
  return typeof val === 'string' ? val.replace(/[\r\n]+/g, '').trim() : fallback;
}

const pool = mysql.createPool({
  host: getEnv('DATABASE_HOST', 'localhost'),
  port: Number(getEnv('DATABASE_PORT', '3306')),
  user: getEnv('DATABASE_USER', 'root'),
  password: getEnv('DATABASE_PASSWORD', ''),
  database: getEnv('DATABASE_NAME', 'wisehospital'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅ Connected to MariaDB');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MariaDB connection error:', err.message);
    process.exit(1);
  });

module.exports = pool;
