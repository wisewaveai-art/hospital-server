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
        const sql = `
            CREATE TABLE IF NOT EXISTS branches (
                id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                organization_id CHAR(36),
                name VARCHAR(255) NOT NULL,
                address TEXT,
                contact_number VARCHAR(50),
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
        `;
        await conn.query(sql);
        console.log('Branches table created/verified.');
        
        try {
            await conn.query('ALTER TABLE doctors ADD COLUMN branch_id CHAR(36) NULL;');
            await conn.query('ALTER TABLE doctors ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;');
            console.log('Added branch_id to doctors');
        } catch (e) {
            console.log('branch_id might already exist in doctors:', e.message);
        }

        try {
            await conn.query('ALTER TABLE appointments ADD COLUMN branch_id CHAR(36) NULL;');
            await conn.query('ALTER TABLE appointments ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;');
            console.log('Added branch_id to appointments');
        } catch (e) {
            console.log('branch_id might already exist in appointments:', e.message);
        }

    } catch (err) {
        console.error('Error running alter schema:', err);
    } finally {
        await conn.end();
    }
}

runAlter();
