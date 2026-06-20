const directDb = require('../utils/directDb');

exports.recordVitals = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const {
            patient_id, blood_pressure, heart_rate, temperature,
            oxygen_saturation, respiratory_rate, weight, height, notes
        } = req.body;
        
        // Ensure user is logged in
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Unauthorized. User ID not found.' });
        }
        
        const recorded_by = req.user.id; // Nurse or Doctor ID
        
        const query = `
            INSERT INTO patient_vitals 
            (organization_id, patient_id, recorded_by, blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate, weight, height, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;
        
        const params = [
            orgId, patient_id, recorded_by, 
            blood_pressure || null, 
            heart_rate || null, 
            temperature || null, 
            oxygen_saturation || null, 
            respiratory_rate || null, 
            weight || null, 
            height || null, 
            notes || null
        ];
        
        const { rows } = await directDb.query(query, params);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Record Vitals Error:', err);
        res.status(500).json({ error: 'Server error recording vitals' });
    }
};

exports.getPatientVitals = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { patientId } = req.params;
        
        const query = `
            SELECT v.*, u.full_name as recorded_by_name, u.role as recorded_by_role
            FROM patient_vitals v
            LEFT JOIN users u ON v.recorded_by = u.id
            WHERE v.patient_id = $1 AND v.organization_id = $2
            ORDER BY v.recorded_at DESC
        `;
        
        const { rows } = await directDb.query(query, [patientId, orgId]);
        res.json(rows);
    } catch (err) {
        console.error('Get Vitals Error:', err);
        res.status(500).json({ error: 'Server error fetching vitals' });
    }
};
