const { tenantQuery, withOrgData } = require('../utils/tenantQuery');

// ... existing functions ...
exports.getAllPatients = async (req, res) => {
    try {
        // 1. Fetch all users with role 'patient' and their patient profile
        const { data: users, error: userError } = await tenantQuery('users', req)
            .select(`
                id, full_name, email, phone, address, created_at, organization_id,
                patients:patients!patients_user_id_fkey(
                    id, blood_group, dob, medical_history, emergency_contact, 
                    patient_type, assigned_doctor_id
                )
            `)
            .eq('role', 'patient')
            .order('created_at', { ascending: false });

        if (userError) throw userError;

        // 2. Extract all assigned_doctor_ids
        const doctorIds = users
            .map(u => {
                const profile = Array.isArray(u.patients) ? u.patients[0] : u.patients;
                return profile ? profile.assigned_doctor_id : null;
            })
            .filter(id => id !== null);

        console.log('Extracted Doctor IDs:', doctorIds);

        // 3. Fetch details for these doctors from USERS table (as requested)
        let doctorsMap = {};
        if (doctorIds.length > 0) {
            const { data: doctors, error: docError } = await supabase
                .from('users')
                .select('id, full_name')
                .in('id', doctorIds);

            if (!docError && doctors) {
                console.log('Fetched Doctors:', doctors.length);
                doctors.forEach(d => { doctorsMap[d.id] = d; });
            } else {
                console.error('Error fetching doctors subset:', docError);
            }
        }

        // 4. Merge doctor details back into the response structure
        const enrichedData = users.map(user => {
            const profile = Array.isArray(user.patients) ? user.patients[0] : user.patients;

            if (profile) {
                const docId = profile.assigned_doctor_id;
                if (docId && doctorsMap[docId]) {
                    // Inject the assigned_doctor object to match frontend expectation
                    profile.assigned_doctor = {
                        full_name: doctorsMap[docId].full_name
                    };
                } else if (docId) {
                    console.warn(`Doctor ID ${docId} not found in fetched map.`);
                }
            }
            return user;
        });

        res.json(enrichedData);
    } catch (err) {
        console.error('Error fetching patients:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.createPatientProfile = async (req, res) => {
    try {
        const patientData = withOrgData({
            user_id, blood_group, dob, medical_history, emergency_contact,
            patient_type: patient_type || 'Outpatient',
            assigned_doctor_id: assigned_doctor_id || null
        }, req);

        const { data, error } = await tenantQuery('patients', req)
            .insert([patientData])
            .select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.getPatientDetails = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`Fetching details for patient ID: ${id}`);

        const { data, error } = await supabase
            .from('patients')
            .select(`
          *,
          users:users!patients_user_id_fkey (full_name, email, phone, gender, address),
          assigned_doctor:users!patients_assigned_doctor_id_fkey (full_name),
          doctor_history:patient_doctor_history (
              id, assigned_date, removed_date,
              doctor:users!patient_doctor_history_doctor_id_fkey (full_name)
          ),
          visits (
              id, visit_date, complaint, diagnosis, notes, next_visit_date, patient_type, medical_reports,
              doctors (users(full_name), specialization),
              prescriptions (dosage, duration, quantity, medicines (name, product_code, type))
          )
        `)
            .eq('id', id)
            .single();

        if (data) {
            if (data.visits) data.visits.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));
            if (data.doctor_history) data.doctor_history.sort((a, b) => new Date(b.assigned_date) - new Date(a.assigned_date));
        }

        if (error) {
            console.error('Supabase Error in getPatientDetails:', error);
            throw error;
        }
        res.json(data);
    } catch (err) {
        console.error('Error in getPatientDetails:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

exports.updatePatient = async (req, res) => {
    try {
        const { id } = req.params; // This is the user_id
        const { full_name, email, phone, address, blood_group, dob, medical_history, emergency_contact, patient_type, assigned_doctor_id } = req.body;

        const { error: userError } = await supabase.from('users').update({ full_name, email, phone, address }).eq('id', id);
        if (userError) throw userError;

        // Fetch current patient to check for doctor change
        const { data: currentPatient } = await supabase
            .from('patients')
            .select('id, assigned_doctor_id')
            .eq('user_id', id)
            .single();

        if (currentPatient) {
            const oldDoc = currentPatient.assigned_doctor_id;
            const newDoc = assigned_doctor_id;

            if (oldDoc !== newDoc) {
                const now = new Date().toISOString();

                // 1. Close old assignment if exists
                if (oldDoc) {
                    await supabase
                        .from('patient_doctor_history')
                        .update({ removed_date: now })
                        .eq('patient_id', currentPatient.id)
                        .eq('doctor_id', oldDoc)
                        .is('removed_date', null);
                }

                // 2. Add new assignment
                if (newDoc) {
                    await supabase
                        .from('patient_doctor_history')
                        .insert([{
                            patient_id: currentPatient.id,
                            doctor_id: newDoc,
                            assigned_date: now
                        }]);
                }
            }
        }

        const { error: patientError } = await supabase
            .from('patients')
            .upsert({
                user_id: id,
                blood_group, dob, medical_history, emergency_contact,
                patient_type, assigned_doctor_id
            }, { onConflict: 'user_id' });

        if (patientError) throw patientError;
        res.json({ message: 'Patient updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.deletePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Patient deleted successfully' });
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.addVisitRecord = async (req, res) => {
    try {
        const { patient_id, doctor_id, complaint, diagnosis, notes, visit_date, next_visit_date, patient_type, medical_reports } = req.body;
        console.log("Adding visit:", req.body);

        const { data, error } = await supabase
            .from('visits')
            .insert([{
                patient_id,
                doctor_id: doctor_id || null, // Ensure empty string becomes null if nullable, or check schema
                complaint,
                diagnosis,
                notes,
                visit_date: visit_date || new Date(),
                next_visit_date: next_visit_date || null,
                patient_type: patient_type || 'Outpatient',
                medical_reports: medical_reports || []
            }])
            .select()
            .single();

        if (error) {
            console.error("Supabase Error:", error);
            throw error;
        }
        res.status(201).json(data);
    } catch (err) {
        console.error('Error adding visit:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.addPrescription = async (req, res) => {
    try {
        const { visit_id, medicine_id, dosage, duration, quantity } = req.body;
        const { data, error } = await supabase.from('prescriptions').insert([{ visit_id, medicine_id, dosage, duration, quantity }]).select().single();
        if (error) throw error;
        if (quantity && medicine_id) {
            const { data: med } = await supabase.from('medicines').select('quantity').eq('id', medicine_id).single();
            if (med) await supabase.from('medicines').update({ quantity: med.quantity - quantity }).eq('id', medicine_id);
        }
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.getPatientIdByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching patient ID:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
