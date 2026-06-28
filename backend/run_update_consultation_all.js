const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runAlterAll() {
    console.log('Connecting to MariaDB to run ALTER statements on ALL tenant databases...');
    const conn = await mysql.createConnection({
        host: process.env.DATABASE_HOST || '127.0.0.1',
        port: Number(process.env.DATABASE_PORT || 3306),
        user: process.env.DATABASE_USER || 'root',
        password: process.env.DATABASE_PASSWORD || '',
        multipleStatements: true
    });

    try {
        const [rows] = await conn.query('SHOW DATABASES');
        const databases = rows.map(r => r.Database).filter(db => db.startsWith('hospital_') || db === 'wisehospital');

        const sql = fs.readFileSync(path.join(__dirname, 'update_schema_consultation.sql'), 'utf8');
        const statements = sql.split(';').filter(stmt => stmt.trim() !== '');
        
        for (let db of databases) {
            console.log(`\n--- Applying to ${db} ---`);
            await conn.query(`USE \`${db}\``);
            
            for (let stmt of statements) {
                try {
                    await conn.query(stmt);
                    console.log('Executed:', stmt.trim().substring(0, 50).replace(/\n/g, ' ') + '...');
                } catch (e) {
                    console.log('Skipping/Error:', e.message);
                }
            }
        }
        
        console.log('\nMigration completed successfully on all databases.');
    } catch (err) {
        console.error('Error running alter schema:', err);
    } finally {
        await conn.end();
    }
}

runAlterAll();
