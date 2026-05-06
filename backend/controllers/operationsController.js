const directDb = require('../utils/directDb');

const getOperations = async (req, res) => {
    try {
        const { role, userId } = req.query;
        const orgId = req.organizationId;

        console.log('Fetching operations for role:', role);
        let queryStr = `
            SELECT o.*, 
                   pu.full_name as patient_name, 
                   du.full_name as doctor_name 
            FROM operations o
            LEFT JOIN patients p ON o.patient_id = p.id
            LEFT JOIN users pu ON p.user_id = pu.id
            LEFT JOIN doctors d ON o.doctor_id = d.id
            LEFT JOIN users du ON d.user_id = du.id
            WHERE o.organization_id = $1
        `;
        let params = [orgId];

        if (role === 'patient' && userId) {
            queryStr += ' AND p.user_id = $2';
            params.push(userId);
        } else if (role === 'doctor' && userId) {
            queryStr += ' AND d.user_id = $2';
            params.push(userId);
        }
        
        queryStr += ' ORDER BY o.operation_date ASC';

        let data = [];
        try {
            const { rows } = await directDb.query(queryStr, params);
            data = rows;
        } catch (e) {
            // Table might not exist yet, safe fallback
            console.log("Operations table missing or query failed, returning empty.");
        }

        // Format to match expected structure if needed
        data = data.map(op => ({
            ...op,
            patient: { full_name: op.patient_name || 'Unknown' },
            doctor: { full_name: op.doctor_name || 'Unknown' }
        }));

        res.json(data);
    } catch (error) {
        console.error('Error fetching operations:', error);
        res.status(500).json({ error: error.message });
    }
};

const createOperation = async (req, res) => {
    try {
        const { patient_id, doctor_id, operation_name, operation_date, notes } = req.body;
        const orgId = req.organizationId;
        
        const insertQuery = `
            INSERT INTO operations (organization_id, patient_id, doctor_id, operation_name, operation_date, notes) 
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `;
        
        let data = null;
        try {
            const { rows } = await directDb.query(insertQuery, [orgId, patient_id, doctor_id, operation_name, operation_date, notes]);
            data = rows[0];
        } catch (e) {
            console.error("Database error in createOperation:", e);
            throw new Error("Database error scheduling operation: " + e.message);
        }

        res.status(201).json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    getOperations,
    createOperation
};
