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
        
        const { rows: patients } = await directDb.query(
            `SELECT u.id, u.email, u.full_name, u.phone, u.address, u.created_at, u.profile_pic,
                    p.id as profile_id, p.blood_group, p.dob, p.medical_history, p.emergency_contact, p.patient_type,
                    p.assigned_doctor_id, p.allergies, p.chronic_diseases, p.current_medications,
                    p.insurance_provider, p.insurance_number, p.blood_pressure, p.sugar_level, p.injury_condition, p.insurance_coverage,
                    d.id as doc_id, du.full_name as doctor_name
             FROM users u
             LEFT JOIN patients p ON u.id = p.user_id
             LEFT JOIN doctors d ON p.assigned_doctor_id = d.id
             LEFT JOIN users du ON d.user_id = du.id
             WHERE u.role = 'patient' AND u.organization_id = $1
             ORDER BY u.created_at DESC`,
             [orgId]
        );
        
        // fetch patient_relations
        const { rows: allRelations } = await directDb.query(
            `SELECT pr.patient_id, pr.related_user_id, pr.relation_type, u.full_name as related_name 
             FROM patient_relations pr
             JOIN users u ON pr.related_user_id = u.id
             WHERE pr.organization_id = $1`, [orgId]
        );

        // Group relations by patient_id
        const relationsByPatient = {};
        for (const r of allRelations) {
            if (!relationsByPatient[r.patient_id]) relationsByPatient[r.patient_id] = [];
            relationsByPatient[r.patient_id].push(r);
        }

        // Fetch recent visits for these patients
        const patientIds = patients.map(r => r.profile_id).filter(Boolean);
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

        const enrichedData = patients.map(p => {
            const recent_visit = p.profile_id ? recentVisitsMap[p.profile_id] : null;

            const patientsArr = p.profile_id ? [{
                id: p.profile_id, 
                blood_group: p.blood_group, 
                dob: p.dob, 
                medical_history: p.medical_history, 
                emergency_contact: p.emergency_contact, 
                patient_type: p.patient_type || 'Outpatient', 
                assigned_doctor_id: p.assigned_doctor_id,
                allergies: p.allergies,
                chronic_diseases: p.chronic_diseases,
                current_medications: p.current_medications,
                insurance_provider: p.insurance_provider,
                insurance_number: p.insurance_number,
                blood_pressure: p.blood_pressure,
                sugar_level: p.sugar_level,
                injury_condition: p.injury_condition,
                insurance_coverage: p.insurance_coverage,
                assigned_doctor: p.doc_id ? {
                    id: p.doc_id,
                    full_name: p.doctor_name
                } : null,
                relations: relationsByPatient[p.profile_id] || [],
                recent_visit: recent_visit
            }] : [];

            return {
                id: p.id,
                email: p.email,
                full_name: p.full_name,
                phone: p.phone,
                address: p.address,
                gender: p.gender,
                created_at: p.created_at,
                patients: patientsArr
            };
        });

        if (req.query.type === 'Discharged') {
            const { rows: dischargedAllocations } = await directDb.query(
                `SELECT DISTINCT patient_id FROM room_allocations WHERE status = 'discharged' AND organization_id = $1`, [orgId]
            );
            const dischargedPatientIds = new Set(dischargedAllocations.map(a => a.patient_id));
            const filteredData = enrichedData.filter(p => p.patients && p.patients.length > 0 && dischargedPatientIds.has(p.patients[0].id));
            return res.json(filteredData);
        }

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
            full_name, email, phone, address, profile_pic,
            blood_group, dob, emergency_contact, medical_history, patient_type, assigned_doctor_id,
            allergies, chronic_diseases, current_medications, insurance_provider, insurance_number,
            blood_pressure, sugar_level, injury_condition, insurance_coverage,
            relations // array of { related_user_id, relation_type }
        } = req.body;

        const orgId = req.organizationId;
        // 1. Update users table
        await directDb.query(
            'UPDATE users SET full_name=$1, email=$2, phone=$3, address=$4, profile_pic=$5 WHERE id=$6 AND organization_id=$7',
            [full_name, email, phone, address, profile_pic, id, orgId]
        );

        // 2. update or insert into patients table
        const dobVal = dob ? dob : null;
        const docVal = (assigned_doctor_id && assigned_doctor_id !== '') ? assigned_doctor_id : null;

        const checkProfile = await directDb.query('SELECT id FROM patients WHERE user_id=$1', [id]);
        
        let patientProfileId = null;

        if (checkProfile.rows.length === 0) {
            const insertResult = await directDb.query(
                `INSERT INTO patients (user_id, organization_id, blood_group, dob, emergency_contact, medical_history, patient_type, assigned_doctor_id, allergies, chronic_diseases, current_medications, insurance_provider, insurance_number, blood_pressure, sugar_level, injury_condition, insurance_coverage)
                 VALUES ($1, (SELECT organization_id FROM users WHERE id=$2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
                 [id, id, blood_group, dobVal, emergency_contact, medical_history, patient_type, docVal, allergies, chronic_diseases, current_medications, insurance_provider, insurance_number, blood_pressure, sugar_level, injury_condition, insurance_coverage]
            );
            
            // Re-fetch to get the patient profile ID
            const newProfile = await directDb.query('SELECT id FROM patients WHERE user_id=$1', [id]);
            patientProfileId = newProfile.rows[0].id;
        } else {
            patientProfileId = checkProfile.rows[0].id;
            await directDb.query(
                `UPDATE patients SET 
                 blood_group=$1, dob=$2, emergency_contact=$3, medical_history=$4, patient_type=$5, assigned_doctor_id=$6,
                 allergies=$7, chronic_diseases=$8, current_medications=$9, insurance_provider=$10, insurance_number=$11,
                 blood_pressure=$12, sugar_level=$13, injury_condition=$14, insurance_coverage=$15
                 WHERE user_id=$16`,
                 [blood_group, dobVal, emergency_contact, medical_history, patient_type, docVal, allergies, chronic_diseases, current_medications, insurance_provider, insurance_number, blood_pressure, sugar_level, injury_condition, insurance_coverage, id]
            );
        }

        // Handle relations
        if (Array.isArray(relations) && patientProfileId) {
            // Delete existing relations for this patient
            await directDb.query('DELETE FROM patient_relations WHERE patient_id=$1 AND organization_id=$2', [patientProfileId, orgId]);
            // Insert new ones
            for (let rel of relations) {
                if (rel.related_user_id && rel.relation_type) {
                    await directDb.query(
                        `INSERT INTO patient_relations (organization_id, patient_id, related_user_id, relation_type) 
                         VALUES ($1, $2, $3, $4)`,
                        [orgId, patientProfileId, rel.related_user_id, rel.relation_type]
                    );
                }
            }
        }

        res.json({ message: 'Patient updated successfully' });
     } catch (err) {
        console.error('Error updating patient:', err);
        res.status(500).json({ error: 'Server error updating patient' });
     }
};

exports.updatePatientType = async (req, res) => {
    try {
        const { id } = req.params; // user id
        const { patient_type } = req.body;
        if (!patient_type) {
            return res.status(400).json({ error: 'patient_type is required' });
        }
        await directDb.query(
            'UPDATE patients SET patient_type=$1 WHERE user_id=$2',
            [patient_type, id]
        );
        res.json({ message: 'Patient type updated successfully' });
    } catch (err) {
        console.error('Error updating patient type:', err);
        res.status(500).json({ error: 'Server error updating patient type' });
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

exports.searchPatients = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { query } = req.query; // phone number or name
        
        if (!query || query.trim().length < 3) {
            return res.json([]);
        }

        const searchTerm = `%${query.trim()}%`;
        const { rows } = await directDb.query(`
            SELECT p.id as patient_id, u.full_name, u.phone, u.email
            FROM patients p
            JOIN users u ON p.user_id = u.id
            WHERE p.organization_id = $1 
            AND (u.phone LIKE $2 OR u.full_name LIKE $2)
            LIMIT 10
        `, [orgId, searchTerm]);

        res.json(rows);
    } catch (err) {
        console.error('Search patients error:', err);
        res.status(500).json({ error: 'Failed to search patients' });
    }
};

exports.uploadReport = async (req, res) => {
    try {
        const { id } = req.params; // patient_id
        const { report_name, uploaded_by } = req.body;
        const orgId = req.organizationId;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const file_url = `/uploads/${req.file.filename}`;
        
        const db = directDb.wrap(req.db);
        await db.query(
            `INSERT INTO patient_reports (organization_id, patient_id, uploaded_by, report_name, file_url) 
             VALUES ($1, $2, $3, $4, $5)`,
            [orgId, id, uploaded_by || null, report_name || 'Investigation Report', file_url]
        );
        
        res.json({ message: 'Report uploaded successfully', file_url });
    } catch (err) {
        console.error('Upload Report Error:', err);
        res.status(500).json({ error: 'Failed to upload report' });
    }
};

exports.getReports = async (req, res) => {
    try {
        const { id } = req.params; // patient_id
        const orgId = req.organizationId;
        
        const db = directDb.wrap(req.db);
        const { rows } = await db.query(
            `SELECT r.*, u.full_name as uploaded_by_name 
             FROM patient_reports r 
             LEFT JOIN users u ON r.uploaded_by = u.id 
             WHERE r.patient_id = $1 AND r.organization_id = $2
             ORDER BY r.created_at DESC`,
            [id, orgId]
        );
        
        res.json(rows);
    } catch (err) {
        console.error('Get Reports Error:', err);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
};

exports.getPatientVitals = async (req, res) => {
    try {
        const { id } = req.params; // this is the patient_id (or user_id depending on how it's passed, but usually it's user_id in this app)
        const orgId = req.organizationId;
        
        // Let's resolve the actual patient profile ID from user_id just in case
        let patientProfileId = id;
        const profileRes = await directDb.query('SELECT id FROM patients WHERE user_id=$1 OR id=$2', [id, id]);
        if (profileRes.rows.length > 0) {
            patientProfileId = profileRes.rows[0].id;
        }

        const { rows } = await directDb.query(
            `SELECT v.*, u.full_name as recorded_by_name, u.role as recorded_by_role 
             FROM patient_vitals v 
             LEFT JOIN users u ON v.recorded_by = u.id 
             WHERE v.patient_id = $1 AND v.organization_id = $2
             ORDER BY v.recorded_at DESC`,
            [patientProfileId, orgId]
        );
        
        res.json(rows);
    } catch (err) {
        console.error('Get Vitals Error:', err);
        res.status(500).json({ error: 'Failed to fetch vitals' });
    }
};

exports.addPatientVitals = async (req, res) => {
    try {
        const { id } = req.params; // patient_id or user_id
        const { blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate, weight, height, notes, recorded_by } = req.body;
        const orgId = req.organizationId;
        
        // Resolve patient profile ID
        let patientProfileId = id;
        const profileRes = await directDb.query('SELECT id FROM patients WHERE user_id=$1 OR id=$2', [id, id]);
        if (profileRes.rows.length > 0) {
            patientProfileId = profileRes.rows[0].id;
        }

        const { rows } = await directDb.query(
            `INSERT INTO patient_vitals (organization_id, patient_id, recorded_by, blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate, weight, height, notes) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [orgId, patientProfileId, recorded_by || req.user?.id || null, blood_pressure, heart_rate, temperature, oxygen_saturation, respiratory_rate, weight, height, notes]
        );
        
        res.json(rows[0]);
    } catch (err) {
        console.error('Add Vitals Error:', err);
        res.status(500).json({ error: 'Failed to add vitals' });
    }
};
