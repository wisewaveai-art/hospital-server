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
        await setupConn.end();

        res.json({ message: 'Database schema synchronized successfully.' });
    } catch (err) {
        console.error('Migration error:', err);
        res.status(500).json({ error: 'Migration failed', details: err.message });
    }
};

