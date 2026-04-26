const directDb = require('../utils/directDb');

exports.getAll = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { rows } = await directDb.query(
            'SELECT * FROM ambulances WHERE organization_id = $1 ORDER BY created_at DESC',
            [orgId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.create = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { vehicle_number, vehicle_model, driver_name, driver_phone, ambulance_type, status, note } = req.body;
        const { rows } = await directDb.query(
            `INSERT INTO ambulances (organization_id, vehicle_number, vehicle_model, driver_name, driver_phone, ambulance_type, status, note) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [orgId, vehicle_number, vehicle_model, driver_name, driver_phone, ambulance_type, status, note]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        const { vehicle_number, vehicle_model, driver_name, driver_phone, ambulance_type, status, note } = req.body;
        
        await directDb.query(
            `UPDATE ambulances SET 
             vehicle_number = $1, vehicle_model = $2, driver_name = $3, driver_phone = $4, 
             ambulance_type = $5, status = $6, note = $7 
             WHERE id = $8 AND organization_id = $9`,
            [vehicle_number, vehicle_model, driver_name, driver_phone, ambulance_type, status, note, id, orgId]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        await directDb.query('DELETE FROM ambulances WHERE id = $1 AND organization_id = $2', [id, orgId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
