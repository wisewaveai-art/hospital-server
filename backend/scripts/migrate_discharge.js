const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    database: process.env.DATABASE_NAME || 'wisehospital',
    port: process.env.DATABASE_PORT || 3306
});

async function migrate() {
    let conn;
    try {
        conn = await pool.getConnection();
        const [orgs] = await conn.query('SELECT db_name FROM organizations WHERE db_name IS NOT NULL');
        
        for (const org of orgs) {
            const dbName = org.db_name;
            try {
                await conn.query(`USE \`${dbName}\``);
                
                await conn.query(`
                    ALTER TABLE room_allocations
                    ADD COLUMN IF NOT EXISTS discharge_notes TEXT,
                    ADD COLUMN IF NOT EXISTS discharge_condition VARCHAR(100);
                `);
                console.log(`Updated ${dbName} room_allocations table successfully.`);
            } catch (err) {
                console.error(`Error updating ${dbName}:`, err.message);
            }
        }
        console.log('Migration complete.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

migrate();
