const pool = require('../db');

// Adapter to convert PostgreSQL `$1, $2` syntax to MySQL `?` and return `.rows`
module.exports = {
    query: async (text, params = []) => {
        // Convert $1, $2, etc. to ?
        const mysqlQuery = text.replace(/\$\d+/g, '?');
        const [rows] = await pool.query(mysqlQuery, params);
        return { rows, rowCount: rows.length };
    },
    pool
};


