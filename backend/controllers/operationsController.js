const directDb = require('../utils/directDb');

const getOperations = async (req, res) => {
    try {
        const { role, userId } = req.query;
        const orgId = req.organizationId;

        console.log('Fetching operations for role:', role);
        let queryStr = `
            SELECT o.*, 
                   pu.full_name as patient_name, 
                   du.full_name as doctor_name,
                   (
                       SELECT JSON_ARRAYAGG(JSON_OBJECT('id', u.id, 'full_name', u.full_name, 'role', op_part.role))
                       FROM operation_participants op_part
                       JOIN users u ON op_part.user_id = u.id
                       WHERE op_part.operation_id = o.id
                   ) as participants
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
        data = data.map(op => {
            let participants = [];
            if (typeof op.participants === 'string') {
                try { participants = JSON.parse(op.participants) || []; } catch(e) {}
            } else if (Array.isArray(op.participants)) {
                participants = op.participants;
            }

            return {
                ...op,
                patient: { full_name: op.patient_name || 'Unknown' },
                doctor: { full_name: op.doctor_name || 'Unknown' },
                participants: participants
            };
        });

        res.json(data);
    } catch (error) {
        console.error('Error fetching operations:', error);
        res.status(500).json({ error: error.message });
    }
};

const createOperation = async (req, res) => {
    try {
        const { operation_name, operation_date, notes, doctor_ids = [], nurse_ids = [], patient_ids = [] } = req.body;
        
        // Fallbacks for backward compatibility
        const { patient_id, doctor_id } = req.body;
        
        const primaryDoctorUserId = doctor_ids.length > 0 ? doctor_ids[0] : (doctor_id || null);
        const primaryPatientUserId = patient_ids.length > 0 ? patient_ids[0] : (patient_id || null);

        let actualPatientId = null;
        if (primaryPatientUserId) {
            const { rows: pRows } = await directDb.query('SELECT id FROM patients WHERE user_id = $1', [primaryPatientUserId]);
            if (pRows.length > 0) actualPatientId = pRows[0].id;
        }

        let actualDoctorId = null;
        if (primaryDoctorUserId) {
            const { rows: dRows } = await directDb.query('SELECT id FROM doctors WHERE user_id = $1', [primaryDoctorUserId]);
            if (dRows.length > 0) actualDoctorId = dRows[0].id;
        }

        const orgId = req.organizationId;
        const opId = require('crypto').randomUUID();
        const insertQuery = `
            INSERT INTO operations (id, organization_id, patient_id, doctor_id, operation_name, operation_date, notes) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await directDb.query(insertQuery, [opId, orgId, actualPatientId, actualDoctorId, operation_name, operation_date, notes]);
        
        // Insert participants
        const participants = [];
        doctor_ids.forEach(id => participants.push([opId, id, 'doctor']));
        nurse_ids.forEach(id => participants.push([opId, id, 'nurse']));
        patient_ids.forEach(id => participants.push([opId, id, 'patient']));

        if (participants.length > 0) {
            for (const p of participants) {
                // Ensure we don't insert duplicates for the same operation and user
                await directDb.query(`
                    INSERT INTO operation_participants (operation_id, user_id, role) 
                    VALUES ($1, $2, $3)
                    ON DUPLICATE KEY UPDATE role = VALUES(role)
                `, p);
            }
        }
        
        const { rows } = await directDb.query('SELECT * FROM operations WHERE id = $1', [opId]);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error("Create operation error:", error);
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    getOperations,
    createOperation
};
