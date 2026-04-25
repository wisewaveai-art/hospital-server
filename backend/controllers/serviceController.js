const directDb = require('../utils/directDb');

// Get all services
exports.getAllServices = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const queryStr = 'SELECT * FROM services WHERE organization_id = $1 ORDER BY name ASC';
        const { rows } = await directDb.query(queryStr, [orgId]);
        
        res.json(rows);
    } catch (err) {
        console.error('Error fetching services:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add new service
exports.addService = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { name, description, cost, status } = req.body;

        const queryStr = `
            INSERT INTO services (organization_id, name, description, cost, status) 
            VALUES ($1, $2, $3, $4, $5) RETURNING *
        `;
        const { rows } = await directDb.query(queryStr, [orgId, name, description || '', cost || 0, status || 'active']);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error adding service:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update service
exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        const updates = req.body;
        
        const columns = Object.keys(updates);
        if(columns.length === 0) return res.json({});

        const values = Object.values(updates);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');

        const queryStr = `UPDATE services SET ${setClause} WHERE id = $${columns.length + 1} AND organization_id = $${columns.length + 2} RETURNING *`;
        const { rows } = await directDb.query(queryStr, [...values, id, orgId]);
        
        if (rows.length === 0) throw new Error("Update Failed");
        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating service:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete service
exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;

        await directDb.query('DELETE FROM services WHERE id = $1 AND organization_id = $2', [id, orgId]);
        res.json({ message: 'Service deleted successfully' });
    } catch (err) {
        console.error('Error deleting service:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
