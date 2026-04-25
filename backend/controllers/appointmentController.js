const directDb = require('../utils/directDb');

const safeQuery = async (queryStr, params = []) => {
    try {
        const { rows } = await directDb.query(queryStr, params);
        return rows;
    } catch (e) {
        console.warn("Table unmigrated or safeQuery fail:", e.message);
        return [];
    }
};

exports.bookAppointment = async (req, res) => {
    try {
        const { patient_user_id, doctor_id, appointment_date, reason } = req.body;
        const orgId = req.organizationId;

        const { rows } = await directDb.query(
            'INSERT INTO appointments (organization_id, patient_user_id, doctor_id, appointment_date, reason, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [orgId, patient_user_id, doctor_id, appointment_date, reason, 'scheduled']
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error booking appointment:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyAppointments = async (req, res) => {
    try {
        const { userId } = req.params; 

        let queryStr = `
            SELECT a.*, 
                   d.id as doc_id, d.specialization, 
                   u.full_name as doctor_name
            FROM appointments a
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE a.patient_user_id = $1
            ORDER BY a.appointment_date ASC
        `;
        
        const rows = await safeQuery(queryStr, [userId]);

        const formatted = rows.map(r => {
            const { doc_id, specialization, doctor_name, ...app } = r;
            return {
                ...app,
                doctors: doc_id ? { id: doc_id, specialization, users: { full_name: doctor_name } } : null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllAppointments = async (req, res) => {
    try {
        let queryStr = `
            SELECT a.*, 
                   p.full_name as patient_name,
                   d.id as doc_profile_id,
                   u.full_name as doctor_name
            FROM appointments a
            LEFT JOIN users p ON a.patient_user_id = p.id
            LEFT JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            ORDER BY a.appointment_date DESC
        `;
        
        const rows = await safeQuery(queryStr);

        const formatted = rows.map(r => {
            const { patient_name, doc_profile_id, doctor_name, ...app } = r;
            return {
                ...app,
                users: patient_name ? { full_name: patient_name } : null,
                doctors: doc_profile_id ? { users: { full_name: doctor_name } } : null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching all appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getDoctorAppointments = async (req, res) => {
    try {
        const { userId } = req.params;

        const docRes = await directDb.query('SELECT id FROM doctors WHERE user_id = $1', [userId]);
        if (docRes.rowCount === 0) {
            return res.json([]);
        }
        
        const doctorId = docRes.rows[0].id;

        let queryStr = `
            SELECT a.*, 
                   p.full_name, p.email, p.phone
            FROM appointments a
            LEFT JOIN users p ON a.patient_user_id = p.id
            WHERE a.doctor_id = $1
            ORDER BY a.appointment_date ASC
        `;
        
        const rows = await safeQuery(queryStr, [doctorId]);

        const formatted = rows.map(r => {
            const { full_name, email, phone, ...app } = r;
            return {
                ...app,
                patient: full_name ? { full_name, email, phone } : null
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching doctor appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
