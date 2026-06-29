const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    const mainPool = mysql.createPool({
        host: process.env.DATABASE_HOST || '127.0.0.1',
        port: Number(process.env.DATABASE_PORT || 3306),
        user: process.env.DATABASE_USER || 'root',
        password: process.env.DATABASE_PASSWORD || '',
        database: process.env.DATABASE_NAME || 'wisehospital',
        multipleStatements: true,
    });

    try {
        const sqlPath = path.join(__dirname, 'update_schema_reports.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Apply to main DB
        await mainPool.query(sql);
        console.log('✅ Applied patient_reports schema to main DB');

        // Apply to tenant DBs
        const [orgs] = await mainPool.query('SELECT id, db_name FROM organizations WHERE db_name IS NOT NULL');
        for (const org of orgs) {
            console.log(`Applying to tenant DB: ${org.db_name}`);
            const tenantPool = mysql.createPool({
                host: process.env.DATABASE_HOST || '127.0.0.1',
                port: Number(process.env.DATABASE_PORT || 3306),
                user: process.env.DATABASE_USER || 'root',
                password: process.env.DATABASE_PASSWORD || '',
                database: org.db_name,
                multipleStatements: true,
            });
            await tenantPool.query(sql);
            console.log(`✅ Applied patient_reports schema to tenant DB: ${org.db_name}`);
            await tenantPool.end();
        }
    } catch (e) {
        console.error('Error running migration', e);
    } finally {
        await mainPool.end();
    }
}

runMigration();
