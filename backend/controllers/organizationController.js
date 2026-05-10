const directDb = require('../utils/directDb');

exports.getCurrentOrganization = async (req, res) => {
    try {
        let orgId = req.organizationId;
        
        let queryStr = 'SELECT * FROM organizations WHERE slug = $1';
        let queryParams = ['main'];

        if (orgId) {
            queryStr = 'SELECT * FROM organizations WHERE id = $1';
            queryParams = [orgId];
        }

        const { rows } = await directDb.pool.query(
          queryStr.replace(/\$\d+/g, '?'), 
          queryParams
        );
        
        // Convert to the format expected by the frontend (.rows)
        const resultRows = rows || [];

        if (resultRows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const row = resultRows[0];
        const jsonCols = ['settings', 'app_theme', 'site_config', 'enabled_modules'];
        jsonCols.forEach(col => {
          if (typeof row[col] === 'string') {
            try { row[col] = JSON.parse(row[col]); } catch(e) {}
          }
        });

        res.json(row);
    } catch (err) {
        console.error('Error in getCurrentOrganization:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAll = async (req, res) => {
    try {
        const [rows] = await directDb.pool.query('SELECT * FROM organizations');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.getById = async (req, res) => {
    try {
        const [rows] = await directDb.pool.query('SELECT * FROM organizations WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.create = async (req, res) => {
    try {
        const { name, slug, logo_url, primary_color, secondary_color } = req.body;
        const [result] = await directDb.pool.query(
            'INSERT INTO organizations (name, slug, logo_url, primary_color, secondary_color) VALUES (?, ?, ?, ?, ?)',
            [name, slug, logo_url, primary_color, secondary_color]
        );
        const [rows] = await directDb.pool.query('SELECT * FROM organizations WHERE id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, logo_url, primary_color, secondary_color, enabled_modules, settings, app_theme } = req.body;
        
        await directDb.query(
            `UPDATE organizations SET 
             name = $1, logo_url = $2, primary_color = $3, secondary_color = $4, 
             enabled_modules = $5, settings = $6, app_theme = $7 
             WHERE id = $8`,
            [name, logo_url, primary_color, secondary_color, 
             JSON.stringify(enabled_modules), JSON.stringify(settings), JSON.stringify(app_theme), id]
        );
        
        const { rows } = await directDb.query('SELECT * FROM organizations WHERE id = $1', [id]);
        res.json(rows[0]);
    } catch (err) { 
        console.error('Update Org Error:', err);
        res.status(500).json({ error: 'Server error' }); 
    }
};
