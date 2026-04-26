const directDb = require('../utils/directDb');

exports.getAll = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { rows } = await directDb.query(
            'SELECT * FROM diagnostic_labs WHERE organization_id = $1 ORDER BY lab_name ASC',
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
        const { lab_name, contact_person, phone, email, address, status, note } = req.body;
        const { rows } = await directDb.query(
            `INSERT INTO diagnostic_labs (organization_id, lab_name, contact_person, phone, email, address, status, note) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [orgId, lab_name, contact_person, phone, email, address, status, note]
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
        const { lab_name, contact_person, phone, email, address, status, note } = req.body;
        
        await directDb.query(
            `UPDATE diagnostic_labs SET 
             lab_name = $1, contact_person = $2, phone = $3, email = $4, 
             address = $5, status = $6, note = $7 
             WHERE id = $8 AND organization_id = $9`,
            [lab_name, contact_person, phone, email, address, status, note, id, orgId]
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
        await directDb.query('DELETE FROM diagnostic_labs WHERE id = $1 AND organization_id = $2', [id, orgId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};
