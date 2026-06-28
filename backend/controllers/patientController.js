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

        // Fetch recent visits for these patients
        const patientIds = rows.map(r => r.patient_profile_id).filter(Boolean);
        let recentVisitsMap = {};
        if (patientIds.length > 0) {
            const placeholders = patientIds.map((_, i) => `$${i+1}`).join(',');
            const visitsQuery = `SELECT * FROM patient_visits WHERE patient_id IN (${placeholders}) ORDER BY visit_date DESC`;
            const visitsRows = await safeQuery(visitsQuery, patientIds);
            visitsRows.forEach(v => {
                if (!recentVisitsMap[v.patient_id]) {
                    // Try to parse notes if it's JSON
                    if (v.notes && v.notes.startsWith('{')) {
                        try { v.parsed_notes = JSON.parse(v.notes); } catch(e){}
                    }
                    if (v.investigation_orders) {
                        try { v.parsed_investigations = typeof v.investigation_orders === 'string' ? JSON.parse(v.investigation_orders) : v.investigation_orders; } catch(e){}
                    }
                    recentVisitsMap[v.patient_id] = v;
                }
            });
        }

        const enrichedData = rows.map(row => {
            const { patient_profile_id, blood_group, dob, medical_history, emergency_contact, patient_type, assigned_doctor_id, doctor_name, ...userObj } = row;
            
            const recent_visit = patient_profile_id ? recentVisitsMap[patient_profile_id] : null;

            const patientsArr = patient_profile_id ? [{
                id: patient_profile_id, 
                blood_group, 
                dob, 
                medical_history, 
                emergency_contact, 
                patient_type: patient_type || 'Outpatient', 
                assigned_doctor_id,
                assigned_doctor: { full_name: doctor_name || 'Unknown' },
                recent_visit: recent_visit
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
        const orgId = req.organizationId;
        const query = `
            SELECT u.*, p.*, p.id as patient_profile_id
            FROM users u
            LEFT JOIN patients p ON u.id = p.user_id
            WHERE (u.id = $1 OR p.id = $2) AND u.organization_id = $3
        `;
        console.log('Fetching patient details for ID:', id, 'Org:', orgId);
        const { rows } = await directDb.query(query, [id, id, orgId]);
        if (rows.length === 0) {
            console.log('No patient found matching the query');
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        const patientData = rows[0];
        
        // Fetch previous visits
        const visitsQuery = `SELECT * FROM patient_visits WHERE patient_id = $1 ORDER BY visit_date DESC LIMIT 5`;
        const visitsRes = await directDb.query(visitsQuery, [id]);
        patientData.previous_visits = visitsRes.rows;

        res.json(patientData);
    } catch (err) {
        console.error('getPatientDetails error:', err);
        res.status(500).json({ error: 'Server error: ' + err.message });
    }
};

exports.updatePatient = async (req, res) => {
     try {
        const { id } = req.params; // this is user id
        const {
            full_name, email, phone, address, 
            blood_group, dob, emergency_contact, medical_history, patient_type, assigned_doctor_id,
            allergies, chronic_diseases, current_medications, insurance_provider, insurance_number
        } = req.body;

        const orgId = req.organizationId;
        // 1. Update users table
        await directDb.query(
            'UPDATE users SET full_name=$1, email=$2, phone=$3, address=$4 WHERE id=$5 AND organization_id=$6',
            [full_name, email, phone, address, id, orgId]
        );

        // 2. update or insert into patients table
        const dobVal = dob ? dob : null;
        const docVal = (assigned_doctor_id && assigned_doctor_id !== '') ? assigned_doctor_id : null;

        const checkProfile = await directDb.query('SELECT id FROM patients WHERE user_id=$1', [id]);
        
        if (checkProfile.rows.length === 0) {
            await directDb.query(
                `INSERT INTO patients (user_id, organization_id, blood_group, dob, emergency_contact, medical_history, patient_type, assigned_doctor_id, allergies, chronic_diseases, current_medications, insurance_provider, insurance_number)
                 VALUES ($1, (SELECT organization_id FROM users WHERE id=$2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                 [id, id, blood_group, dobVal, emergency_contact, medical_history, patient_type, docVal, allergies, chronic_diseases, current_medications, insurance_provider, insurance_number]
            );
        } else {
            await directDb.query(
                `UPDATE patients SET 
                 blood_group=$1, dob=$2, emergency_contact=$3, medical_history=$4, patient_type=$5, assigned_doctor_id=$6,
                 allergies=$7, chronic_diseases=$8, current_medications=$9, insurance_provider=$10, insurance_number=$11
                 WHERE user_id=$12`,
                 [blood_group, dobVal, emergency_contact, medical_history, patient_type, docVal, allergies, chronic_diseases, current_medications, insurance_provider, insurance_number, id]
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
        const orgId = req.organizationId;
        await directDb.query('DELETE FROM users WHERE id=$1 AND organization_id=$2', [id, orgId]);
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

exports.addPrescription = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { visit_id, medicine_id, dosage, duration, quantity } = req.body;
        const query = `
            INSERT INTO prescriptions (organization_id, visit_id, medicine_id, dosage, duration, quantity)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
        `;
        const { rows } = await directDb.query(query, [orgId, visit_id, medicine_id, dosage, duration, quantity]);
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add prescription' });
    }
};

exports.saveConsultation = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { patient_id, doctor_id, diagnosis, secondary_diagnosis, prescription_details, notes, investigation_orders, referral_to, follow_up_date } = req.body;
        
        // Resolve patient ID (frontend might send user.id)
        const patientLookup = await directDb.query('SELECT id, user_id FROM patients WHERE user_id=$1 OR id=$2 LIMIT 1', [patient_id, patient_id]);
        if (patientLookup.rows.length === 0) return res.status(404).json({ error: 'Patient profile not found' });
        const actualPatientId = patientLookup.rows[0].id;
        const actualPatientUserId = patientLookup.rows[0].user_id;
        
        // Resolve doctor ID (frontend sends user.id from localStorage)
        const doctorLookup = await directDb.query('SELECT id FROM doctors WHERE user_id=$1 OR id=$2 LIMIT 1', [doctor_id, doctor_id]);
        if (doctorLookup.rows.length === 0) return res.status(404).json({ error: 'Doctor profile not found' });
        const actualDoctorId = doctorLookup.rows[0].id;

        // 1. Create a Visit record with all the consultation details
        const query = `
            INSERT INTO patient_visits 
            (organization_id, patient_id, doctor_id, diagnosis, secondary_diagnosis, notes, investigation_orders, referral_to, next_visit_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
        `;
        const { rows } = await directDb.query(query, [
            orgId, actualPatientId, actualDoctorId, diagnosis, secondary_diagnosis, 
            JSON.stringify({ clinical_notes: notes, prescription: prescription_details }), 
            JSON.stringify(investigation_orders || []), referral_to, follow_up_date || null
        ]);
        
        // Auto-complete any pending appointments for this patient and doctor
        try {
            await directDb.query(`
                UPDATE appointments 
                SET status = 'Completed' 
                WHERE patient_user_id = $1 AND doctor_id = $2 AND (status IS NULL OR status != 'Completed')
            `, [actualPatientUserId, actualDoctorId]);
        } catch(e) { 
            console.error('Failed to auto-complete appointment:', e); 
        }
        
        res.json({ message: 'Consultation saved successfully', visit: rows[0] });
    } catch (err) {
        console.error('Save Consultation Error:', err);
        res.status(500).json({ error: 'Failed to save consultation' });
    }
};
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

exports.quickAddPatient = async (req, res) => {
    try {
        const { full_name, email, phone, gender, patient_type } = req.body;
        const orgId = req.organizationId;
        const assignedType = patient_type || 'Outpatient';

        // 1. Check if user already exists
        const existingUser = await directDb.query('SELECT id, role FROM users WHERE email = $1', [email]);
        let userId;

        if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
            // Ensure they are a patient or update their role if appropriate?
            // For now, just use them.
        } else {
            // Create New User
            await directDb.query(
                'INSERT INTO users (organization_id, full_name, email, phone, gender, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [orgId, full_name, email, phone, gender, 'patient', 'no-password-login-via-otp']
            );
            const userRes = await directDb.query('SELECT id FROM users WHERE email = $1 AND organization_id = $2', [email, orgId]);
            userId = userRes.rows[0].id;
        }

        // 2. Check if Patient Profile exists
        const existingProfile = await directDb.query('SELECT id FROM patients WHERE user_id = $1', [userId]);
        let patientId;

        if (existingProfile.rows.length > 0) {
            patientId = existingProfile.rows[0].id;
        } else {
            // Create Patient Profile
            await directDb.query(
                'INSERT INTO patients (organization_id, user_id, patient_type) VALUES ($1, $2, $3)',
                [orgId, userId, assignedType]
            );
            const patientRes = await directDb.query('SELECT id FROM patients WHERE user_id = $1', [userId]);
            patientId = patientRes.rows[0].id;
        }
        
        res.json({ 
            userId: userId, 
            patientId: patientId,
            full_name: full_name 
        });
    } catch (err) {
        console.error('Quick Add Error:', err);
        res.status(500).json({ error: 'Failed to add patient' });
    }
};

