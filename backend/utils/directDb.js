const pool = require('../db');

// Adapter to convert PostgreSQL `$1, $2` syntax to MySQL `?` and return `.rows`
module.exports = {
    query: async (text, params = []) => {
        // Convert $1, $2, etc. to ?
        const mysqlQuery = text.replace(/\$\d+/g, '?');
        
        // Ensure objects are stringified for JSON columns in MySQL
        const safeParams = params.map(p => 
            (p !== null && typeof p === 'object' && !(p instanceof Date)) ? JSON.stringify(p) : p
        );

        const [rows] = await pool.query(mysqlQuery, safeParams);
        
        // Handle MySQL/MariaDB ResultSetHeader for INSERT/UPDATE/DELETE
        if (rows && !Array.isArray(rows)) {
            return { 
                rows: [], 
                rowCount: rows.affectedRows || 0,
                insertId: rows.insertId
            };
        }

        return { rows: rows || [], rowCount: (rows || []).length };
    },
    pool
};


