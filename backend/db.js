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
  connectionLimit: 100,
  queueLimit: 0,
});

// Test connection on startup
const fs = require('fs');
const path = require('path');
// Trigger restart pat

pool.getConnection()
  .then(async conn => {
    console.log('✅ Connected to MariaDB');
    
    try {
        const possiblePaths = [
            path.join(__dirname, '..', 'mariadb_schema.sql'),
            path.join(__dirname, 'mariadb_schema.sql')
        ];
        
        let schemaPath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                schemaPath = p;
                break;
            }
        }

        if (schemaPath) {
            console.log(`📄 Found schema file at: ${schemaPath}`);
            console.log('⏳ Synchronizing schema...');
            const sql = fs.readFileSync(schemaPath, 'utf8');
            
            const setupConn = await mysql.createConnection({
                host: getEnv('DATABASE_HOST', '127.0.0.1'),
                port: Number(getEnv('DATABASE_PORT', '3306')),
                user: getEnv('DATABASE_USER', 'root'),
                password: getEnv('DATABASE_PASSWORD', ''),
                database: getEnv('DATABASE_NAME', 'wisehospital'),
                multipleStatements: true
            });
            
            await setupConn.query(sql);
            await setupConn.end();
            console.log('✅ Schema synchronized successfully.');
        } else {
            console.log('ℹ️ No schema file found, skipping synchronization.');
        }
    } catch (err) {
        console.error('❌ Schema sync error:', err.message);
    }
    
    conn.release();
  })
  .catch(err => {
    console.error('❌ MariaDB connection error:', err.message);
    process.exit(1);
  });

module.exports = pool;

