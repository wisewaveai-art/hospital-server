const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function runSchema() {
    console.log('Connecting to MariaDB to run schema...');
    
    // We connect directly using env vars to avoid issues with pool initialization during setup
    const conn = await mysql.createConnection({
        host: process.env.DATABASE_HOST || '127.0.0.1',
        port: Number(process.env.DATABASE_PORT || 3306),
        user: process.env.DATABASE_USER || 'root',
        password: process.env.DATABASE_PASSWORD || '',
        database: process.env.DATABASE_NAME || 'wisehospital',
        multipleStatements: true // Allows running multiple queries from a file
    });

    try {
        const schemaPath = path.join(__dirname, '..', 'mariadb_schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Executing schema...');
        await conn.query(sql);
        console.log('Schema executed successfully. Tables created.');

    } catch (err) {
        console.error('Error running schema:', err);
    } finally {
        await conn.end();
    }
}

runSchema();
