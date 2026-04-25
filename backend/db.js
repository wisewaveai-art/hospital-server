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
const fs = require('fs');
const path = require('path');
// Trigger restart

pool.getConnection()
  .then(async conn => {
    console.log('✅ Connected to MariaDB');
    
    try {
        console.log('Synchronizing schema...');
        const schemaPath = path.join(__dirname, '..', 'mariadb_schema.sql');
        if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            // Enable multiple statements on this conn just for schema setup
            const setupConn = await mysql.createConnection({
                host: getEnv('DATABASE_HOST', 'localhost'),
                port: Number(getEnv('DATABASE_PORT', '3306')),
                user: getEnv('DATABASE_USER', 'root'),
                password: getEnv('DATABASE_PASSWORD', ''),
                database: getEnv('DATABASE_NAME', 'wisehospital'),
                multipleStatements: true
            });
            await setupConn.query(sql);
            await setupConn.end();
            console.log('Schema synchronized successfully.');
        }
    } catch (err) {
        console.error('Schema sync error:', err.message);
    }
    
    conn.release();
  })
  .catch(err => {
    console.error('❌ MariaDB connection error:', err.message);
    process.exit(1);
  });

module.exports = pool;

