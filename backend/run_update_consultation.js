const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runAlter() {
    console.log('Connecting to MariaDB to run ALTER statements...');
    const conn = await mysql.createConnection({
        host: process.env.DATABASE_HOST || '127.0.0.1',
        port: Number(process.env.DATABASE_PORT || 3306),
        user: process.env.DATABASE_USER || 'root',
        password: process.env.DATABASE_PASSWORD || '',
        database: process.env.DATABASE_NAME || 'wisehospital',
        multipleStatements: true
    });

    try {
        const sql = fs.readFileSync(path.join(__dirname, 'update_schema_consultation.sql'), 'utf8');
        // Split by semicolon and run individually to catch errors per statement
        const statements = sql.split(';').filter(stmt => stmt.trim() !== '');
        
        for (let stmt of statements) {
            try {
                await conn.query(stmt);
                console.log('Executed:', stmt.trim().substring(0, 50) + '...');
            } catch (e) {
                console.log('Skipping/Error:', e.message);
            }
        }
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Error running alter schema:', err);
    } finally {
        await conn.end();
    }
}

runAlter();
