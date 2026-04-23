const pool = require('../db');

// Direct DB connection using our mysql configured pool
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};

