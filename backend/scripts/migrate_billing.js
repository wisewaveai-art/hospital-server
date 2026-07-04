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
                    ALTER TABLE invoices
                    ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0.00,
                    ADD COLUMN IF NOT EXISTS discount DECIMAL(12,2) DEFAULT 0.00,
                    ADD COLUMN IF NOT EXISTS tax_percentage DECIMAL(5,2) DEFAULT 0.00,
                    ADD COLUMN IF NOT EXISTS notes TEXT;
                `);

                await conn.query(`
                    CREATE TABLE IF NOT EXISTS invoice_items (
                        id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
                        organization_id CHAR(36),
                        invoice_id CHAR(36),
                        description VARCHAR(255) NOT NULL,
                        quantity INT DEFAULT 1,
                        unit_price DECIMAL(10,2) DEFAULT 0.00,
                        total_price DECIMAL(10,2) DEFAULT 0.00,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
                    );
                `);

                console.log(`Updated ${dbName} billing schema successfully.`);
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
