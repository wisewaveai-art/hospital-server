// Migration needs to be re-written for MariaDB syntax
exports.runMigration = async (req, res) => {
    // Basic security: only allow superadmin or a secret key
    if (req.user?.role !== 'superadmin' && req.headers['x-migration-key'] !== 'wise-secret-123') {
        return res.status(403).json({ error: 'Unauthorized migration attempt' });
    }

    try {
        const fs = require('fs');
        const path = require('path');
        const directDb = require('../utils/directDb');
        const mysql = require('mysql2/promise');

        const schemaPath = path.join(__dirname, '..', '..', 'mariadb_schema.sql');
        if (!fs.existsSync(schemaPath)) {
            return res.status(404).json({ error: 'Schema file not found' });
        }

        const sql = fs.readFileSync(schemaPath, 'utf8');
        
        // Use a separate connection with multipleStatements enabled
        const setupConn = await mysql.createConnection({
            host: process.env.DATABASE_HOST || 'localhost',
            port: Number(process.env.DATABASE_PORT || '3306'),
            user: process.env.DATABASE_USER || 'root',
            password: process.env.DATABASE_PASSWORD || '',
            database: process.env.DATABASE_NAME || 'wisehospital',
            multipleStatements: true
        });

        await setupConn.query(sql);

        // Patch appointments table
        const patchColumns = async () => {
            const cols = [
                { name: 'patient_user_id', alt: 'patient_id', type: 'CHAR(36)' },
                { name: 'appointment_date', alt: 'date', type: 'DATETIME' },
                { name: 'reason', type: 'TEXT' },
                { name: 'status', type: 'VARCHAR(50) DEFAULT "scheduled"' },
                { name: 'organization_id', type: 'CHAR(36)' }
            ];

            for (const col of cols) {
                try {
                    if (col.alt) {
                        try {
                            await setupConn.query(`ALTER TABLE appointments CHANGE COLUMN ${col.alt} ${col.name} ${col.type}`);
                            continue;
                        } catch(e) {}
                    }
                    await setupConn.query(`ALTER TABLE appointments ADD COLUMN ${col.name} ${col.type}`);
                } catch(e) {}
            }

            // Fix Foreign Key if it's pointing to patients instead of users
            try {
                // First, find the constraint name for patient_user_id
                const [constraints] = await setupConn.query(`
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_NAME = 'appointments' 
                      AND COLUMN_NAME = 'patient_user_id' 
                      AND REFERENCED_TABLE_NAME = 'patients'
                `);
                
                for (const c of constraints) {
                    await setupConn.query(`ALTER TABLE appointments DROP FOREIGN KEY ${c.CONSTRAINT_NAME}`);
                }
                
                // Add the correct one
                await setupConn.query(`ALTER TABLE appointments ADD CONSTRAINT fk_apt_patient_user FOREIGN KEY (patient_user_id) REFERENCES users(id) ON DELETE CASCADE`);
            } catch(e) {
                // Maybe already correct or other issue
            }
        };

        await patchColumns();
        await setupConn.end();

        res.json({ message: 'Database schema synchronized and patched successfully.' });
    } catch (err) {
        console.error('Migration error:', err);
        res.status(500).json({ error: 'Migration failed', details: err.message });
    }
};

