const pool = require('../db');

exports.getSettings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM organizations LIMIT 1');
    if (result.rowCount === 0) {
      const insertRes = await pool.query('INSERT INTO organizations (name) VALUES ($1) RETURNING *', ['Wise City Hospital']);
      return res.json(insertRes.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get Settings Error:', err);
    res.status(500).json({ error: 'Server error fetching settings' });
  }
};

exports.updateSettings = async (req, res) => {
    try {
        const updates = req.body;

        // Remove any fields that shouldn't be updated directly like id or created_at if passed
        delete updates.id;
        delete updates.created_at;

        const existing = await pool.query('SELECT * FROM organizations LIMIT 1');
        const current = existing.rowCount ? existing.rows[0] : null;

        let result;
        if (!current) {
            // Insert
            let result;
            if (!current) {
                // Insert new organization with provided fields
                const columns = Object.keys(updates);
                const values = Object.values(updates);
                const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
                const insertQuery = `INSERT INTO organizations (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
                const insertRes = await pool.query(insertQuery, values);
                result = insertRes.rows[0];
            } else {
                // Update existing organization
                const columns = Object.keys(updates);
                const values = Object.values(updates);
                const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
                const updateQuery = `UPDATE organizations SET ${setClause} WHERE id = $${columns.length + 1} RETURNING *`;
                const updateRes = await pool.query(updateQuery, [...values, current.id]);
                result = updateRes.rows[0];
            }
            res.json(result);
        }

        res.json(result);
    } catch (err) {
        console.error('Update Settings Error:', err);
        res.status(500).json({ error: 'Server error updating settings' });
    }
};

const PRESET_THEMES = [
    {
        name: 'Default Dark',
        colors: {
            textColor: '#ffffff',
            dangerColor: '#ef4444',
            primaryColor: '#6366f1',
            backgroundColor: '#020617',
            headerColor: '#0f172a',
            modalColor: '#1e293b'
        }
    },
    {
        name: 'Ocean Drift',
        colors: {
            textColor: '#f8fafc',
            dangerColor: '#fb7185',
            primaryColor: '#38bdf8',
            backgroundColor: '#0f172a',
            headerColor: '#1e293b',
            modalColor: '#334155'
        }
    },
    {
        name: 'Forest Night',
        colors: {
            textColor: '#f0fdf4',
            dangerColor: '#f87171',
            primaryColor: '#22c55e',
            backgroundColor: '#064e3b',
            headerColor: '#065f46',
            modalColor: '#047857'
        }
    },
    {
        name: 'Royal Purple',
        colors: {
            textColor: '#faf5ff',
            dangerColor: '#f43f5e',
            primaryColor: '#a855f7',
            backgroundColor: '#2e1065',
            headerColor: '#4c1d95',
            modalColor: '#5b21b6'
        }
    },
    {
        name: 'Cyberpunk',
        colors: {
            textColor: '#ffffff',
            dangerColor: '#ff00ff',
            primaryColor: '#00ffff',
            backgroundColor: '#000000',
            headerColor: '#1a1a1a',
            modalColor: '#2a2a2a'
        }
    }
];

exports.getPresets = async (req, res) => {
    res.json(PRESET_THEMES);
};

exports.getTheme = async (req, res) => {
    try {
        const result = await pool.query('SELECT app_theme FROM organizations LIMIT 1');
    if (result.rowCount === 0) {
        return res.json({});
    }
    const data = result.rows[0];

        res.json(data.app_theme || {});
    } catch (err) {
        console.error('Get Theme Error:', err);
        res.status(500).json({ error: 'Server error fetching theme' });
    }
};

exports.updateTheme = async (req, res) => {
    try {
        const { theme } = req.body;
        
        const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
    if (orgResult.rowCount === 0) {
        return res.status(404).json({ error: 'Organization not found' });
    }
    const orgId = orgResult.rows[0].id;
    const updateRes = await pool.query('UPDATE organizations SET app_theme = $1 WHERE id = $2 RETURNING app_theme', [theme, orgId]);
    const data = updateRes.rows[0];
        res.json(data.app_theme);
    } catch (err) {
        console.error('Update Theme Error:', err);
        res.status(500).json({ error: 'Server error updating theme' });
    }
};
