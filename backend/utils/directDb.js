const pool = require('../db');

/**
 * Creates a query adapter for a specific database pool
 */
const createQueryAdapter = (targetPool) => {
    return {
        query: async (text, params = []) => {
            // Check if there is a tenant-specific pool in the current async context
            const contextPool = pool.dbStorage.getStore();
            const activePool = contextPool || targetPool;

            // Convert $1, $2, etc. to ?
            const mysqlQuery = text.replace(/\$\d+/g, '?');
            
            // Ensure objects are stringified for JSON columns in MariaDB
            const safeParams = params.map(p => 
                (p !== null && typeof p === 'object' && !(p instanceof Date)) ? JSON.stringify(p) : p
            );

            const [rows] = await activePool.query(mysqlQuery, safeParams);
            
            // Handle MariaDB ResultSetHeader for INSERT/UPDATE/DELETE
            if (rows && !Array.isArray(rows)) {
                return { 
                    rows: [], 
                    rowCount: rows.affectedRows || 0,
                    insertId: rows.insertId
                };
            }

            return { rows: rows || [], rowCount: (rows || []).length };
        },
        pool: targetPool
    };
};

// Default instance for legacy code
const defaultAdapter = createQueryAdapter(pool);
defaultAdapter.wrap = createQueryAdapter;

module.exports = defaultAdapter;


