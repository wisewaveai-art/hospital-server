const { tenantQuery, withOrgData } = require('../utils/tenantQuery');

// Book an appointment
exports.bookAppointment = async (req, res) => {
    try {
        const { patient_user_id, doctor_id, appointment_date, reason } = req.body;

        const appointmentData = withOrgData({ 
            patient_user_id, 
            doctor_id, 
            appointment_date, 
            reason 
        }, req);

        const { data, error } = await tenantQuery('appointments', req)
            .insert([appointmentData])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error booking appointment:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get appointments for a specific patient (User)
exports.getMyAppointments = async (req, res) => {
    try {
        const { userId } = req.params; // Using userId from URL or Auth token context

        // Join with doctors to get doctor names
        // Note: doctors table has user_id, so we need to join doctors -> users to get name OR just get doctor details.
        // Structure: appointments -> doctors -> users (for name)
        // Supabase nested join: `doctors(specialization, users(full_name))`

        const { data, error } = await tenantQuery('appointments', req)
            .select('*, doctors(id, specialization, users(full_name))')
            .eq('patient_user_id', userId)
            .order('appointment_date', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all appointments (Admin/Doctor view)
exports.getAllAppointments = async (req, res) => {
    try {
        const { data, error } = await tenantQuery('appointments', req)
            .select('*, users(full_name), doctors(users(full_name))')
            .order('appointment_date', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching all appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getDoctorAppointments = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find doctor_id from user_id
        const { data: doctor, error: docError } = await supabase
            .from('doctors')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (docError) throw docError;

        // Get appointments
        const { data, error } = await supabase
            .from('appointments')
            .select('*, patient:users!patient_user_id(full_name, email, phone)')
            .eq('doctor_id', doctor.id)
            .order('appointment_date', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching doctor appointments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
