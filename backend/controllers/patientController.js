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

exports.getAllPatients = async (req, res) => {
    try {
        const orgId = req.organizationId;
        let queryStr = `
            SELECT u.id, u.full_name, u.email, u.phone, u.address, u.created_at, u.organization_id, 
                   p.id as patient_profile_id, p.blood_group, p.dob, p.medical_history, p.emergency_contact, p.patient_type, p.assigned_doctor_id, 
                   doc.full_name as doctor_name
            FROM users u
            LEFT JOIN patients p ON u.id = p.user_id
            LEFT JOIN users doc ON p.assigned_doctor_id = doc.id
            WHERE u.role = 'patient'
        `;
        let params = [];

        if (orgId && req.user?.role !== 'superadmin') {
            queryStr += ' AND u.organization_id = $1';
            params.push(orgId);
        }
        queryStr += ' ORDER BY u.created_at DESC';

        const rows = await safeQuery(queryStr, params);

        const enrichedData = rows.map(row => {
            const { patient_profile_id, blood_group, dob, medical_history, emergency_contact, patient_type, assigned_doctor_id, doctor_name, ...userObj } = row;
            
            const patientsArr = patient_profile_id ? [{
                id: patient_profile_id, 
                blood_group, 
                dob, 
                medical_history, 
                emergency_contact, 
                patient_type: patient_type || 'Outpatient', 
                assigned_doctor_id,
                assigned_doctor: { full_name: doctor_name || 'Unknown' }
            }] : [];

            return {
                ...userObj,
                patients: patientsArr
            };
        });

        res.json(enrichedData);
    } catch (err) {
        console.error('Error fetching patients:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createPatientProfile = async (req, res) => {
    try {
        const { user_id } = req.body;
        const orgId = req.organizationId;
        const insertQuery = `INSERT INTO patients (user_id, organization_id) VALUES ($1, $2) RETURNING *`;
        const { rows } = await directDb.query(insertQuery, [user_id, orgId]);
        res.json(rows[0]);
    } catch(err) {
        console.error(err); res.status(500).json({error: 'Failed to create profile'});
    }
};

exports.getPatientDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT u.*, p.*, p.id as patient_profile_id
            FROM users u
            LEFT JOIN patients p ON u.id = p.user_id
            WHERE p.id = $1
        `;
        const { rows } = await directDb.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

exports.updatePatient = async (req, res) => {
     try {
        const { id } = req.params; // this is user id
        const {
            full_name, email, phone, address, 
            blood_group, dob, emergency_contact, medical_history, patient_type, assigned_doctor_id
        } = req.body;

        // 1. Update users table
        await directDb.query(
            'UPDATE users SET full_name=$1, email=$2, phone=$3, address=$4 WHERE id=$5',
            [full_name, email, phone, address, id]
        );

        // 2. update or insert into patients table
        const dobVal = dob ? dob : null;
        const docVal = (assigned_doctor_id && assigned_doctor_id !== '') ? assigned_doctor_id : null;

        const checkProfile = await directDb.query('SELECT id FROM patients WHERE user_id=$1', [id]);
        
        if (checkProfile.rows.length === 0) {
            await directDb.query(
                `INSERT INTO patients (user_id, organization_id, blood_group, dob, emergency_contact, medical_history, patient_type, assigned_doctor_id)
                 VALUES ($1, (SELECT organization_id FROM users WHERE id=$2), $3, $4, $5, $6, $7, $8)`,
                 [id, id, blood_group, dobVal, emergency_contact, medical_history, patient_type, docVal]
            );
        } else {
            await directDb.query(
                `UPDATE patients SET 
                 blood_group=$1, dob=$2, emergency_contact=$3, medical_history=$4, patient_type=$5, assigned_doctor_id=$6
                 WHERE user_id=$7`,
                 [blood_group, dobVal, emergency_contact, medical_history, patient_type, docVal, id]
            );
        }

        res.json({ message: 'Patient updated successfully' });
     } catch (err) {
        console.error('Error updating patient:', err);
        res.status(500).json({ error: 'Server error updating patient' });
     }
};

exports.deletePatient = async (req, res) => {
    try {
        const { id } = req.params; // user id
        await directDb.query('DELETE FROM users WHERE id=$1', [id]);
        res.json({ message: 'Patient deleted' });
    } catch(err) {
        res.status(500).json({error: 'Failed to delete'});
    }
};

exports.addVisitRecord = async (req, res) => {
    try {
        const { patient_id, visit_date, next_visit_date, patient_type, doctor_id, complaint, diagnosis, notes } = req.body;
        const orgId = req.organizationId;
        
        // 1. insert visit
        const insertQuery = `
            INSERT INTO patient_visits (patient_id, organization_id, visit_date, next_visit_date, doctor_id, complaint, diagnosis, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
        `;
        const nextVisit = next_visit_date ? next_visit_date : null;
        const docVal = (doctor_id && doctor_id !== '') ? doctor_id : null;

        await directDb.query(insertQuery, [patient_id, orgId, visit_date, nextVisit, docVal, complaint, diagnosis, notes]);

        // 2. optionally update patient_type
        if (patient_type) {
            await directDb.query('UPDATE patients SET patient_type=$1 WHERE id=$2', [patient_type, patient_id]);
        }
        res.json({ message: 'Visit recorded' });
    } catch(err) {
        console.error(err); res.status(500).json({error: 'Failed to add visit'});
    }
};

exports.addPrescription = async (req, res) => res.json({});
exports.getPatientIdByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const { rows } = await directDb.query('SELECT id FROM patients WHERE user_id = $1', [userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
        res.json({ id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};
