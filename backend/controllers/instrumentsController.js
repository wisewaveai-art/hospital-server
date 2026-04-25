const directDb = require('../utils/directDb');

// Get all instruments
exports.getAllInstruments = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const queryStr = 'SELECT * FROM instruments WHERE organization_id = $1 ORDER BY next_service_date ASC NULLS LAST';
        const { rows } = await directDb.query(queryStr, [orgId]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching instruments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add new instrument
exports.addInstrument = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { name, purchase_date, next_service_date, warranty_expiry, status } = req.body;

        const queryStr = `
            INSERT INTO instruments (organization_id, name, purchase_date, next_service_date, warranty_expiry, status) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `;
        const { rows } = await directDb.query(queryStr, [orgId, name, purchase_date || null, next_service_date || null, warranty_expiry || null, status || 'active']);
        
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error adding instrument:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update instrument
exports.updateInstrument = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        const updates = req.body;

        const columns = Object.keys(updates);
        if (columns.length === 0) return res.json({});

        const values = Object.values(updates);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        
        const queryStr = `UPDATE instruments SET ${setClause} WHERE id = $${columns.length + 1} AND organization_id = $${columns.length + 2} RETURNING *`;
        const { rows } = await directDb.query(queryStr, [...values, id, orgId]);

        if (rows.length === 0) throw new Error("Update Failed");
        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating instrument:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete instrument
exports.deleteInstrument = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        
        await directDb.query('DELETE FROM instruments WHERE id = $1 AND organization_id = $2', [id, orgId]);
        res.json({ message: 'Instrument deleted successfully' });
    } catch (err) {
        console.error('Error deleting instrument:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
