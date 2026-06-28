const directDb = require('../utils/directDb');

exports.getBranches = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { rows } = await directDb.query(
            'SELECT * FROM branches WHERE organization_id = $1 ORDER BY name ASC',
            [orgId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching branches:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createBranch = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { name, address, contact_number } = req.body;
        
        await directDb.query(
            'INSERT INTO branches (organization_id, name, address, contact_number) VALUES ($1, $2, $3, $4)',
            [orgId, name, address, contact_number]
        );
        
        const { rows } = await directDb.query(
            'SELECT * FROM branches WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1',
            [orgId]
        );
        
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error creating branch:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
