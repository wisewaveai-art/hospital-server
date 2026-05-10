const pool = require('../db');

/**
 * Middleware to handle organization/tenant detection
 * Supports:
 * 1. Subdomain-based: org1.wisehospital.com
 * 2. Header-based (for dev/mobile): x-organization-id
 */
const tenantHandler = async (req, res, next) => {
    try {
        let organizationId = req.headers['x-organization-id'];
        let slug = req.headers['x-organization-slug'];

        if (!slug) {
            const host = req.get('host');
            const parts = host.split('.');
            if (parts.length > 2 && !host.includes('localhost') && !host.includes('127.0.0.1')) {
                slug = parts[0];
            }
        }

        if (slug) {
            const [rows] = await pool.query(
                `SELECT id FROM organizations WHERE slug = ? LIMIT 1`,
                [slug]
            );

            if (rows && rows.length > 0) {
                organizationId = rows[0].id;
            }
        }

        if (!organizationId && (req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1'))) {
            organizationId = '00000000-0000-0000-0000-000000000000';
        }

        // --- NEW: Attach the correct database pool to the request ---
        req.organizationId = organizationId;
        const tenantPool = await pool.getTenantDb(organizationId);
        req.db = tenantPool;
        
        // Use AsyncLocalStorage to provide the pool to all downstream code (like directDb)
        pool.dbStorage.run(tenantPool, () => {
            next();
        });
    } catch (err) {
        console.error('Tenant Handler Error:', err);
        req.db = pool; // Fallback to main pool
        pool.dbStorage.run(pool, () => {
            next();
        });
    }
};

module.exports = tenantHandler;
