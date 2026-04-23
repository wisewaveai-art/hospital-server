const supabase = require('../supabaseClient');

// Helper to generate Report ID (LR-YYYY-RUNNING_NUM)
const generateReportId = async () => {
    const year = new Date().getFullYear();
    const { count } = await supabase.from('lab_reports').select('*', { count: 'exact', head: true });
    const num = String(count + 1).padStart(3, '0');
    return `LR-${year}-${num}`;
};

// Get All Reports (With optional filters)
exports.getAllReports = async (req, res) => {
    try {
        const { doctor_id, patient_id, status } = req.query;

        let query = supabase
            .from('lab_reports')
            .select(`
                *,
                patients (
                    id, 
                    users:users!patients_user_id_fkey (full_name, gender, phone)
                ),
                doctors (
                    id, 
                    users (full_name)
                )
            `)
            .order('created_at', { ascending: false });

        if (doctor_id) query = query.eq('doctor_id', doctor_id);
        if (patient_id) query = query.eq('patient_id', patient_id);
        if (status) query = query.eq('status', status);

        const { data, error } = await query;
        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error('Error fetching lab reports:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create Report
exports.createReport = async (req, res) => {
    try {
        const {
            patient_id, doctor_id, test_category, test_name,
            sample_type, department, collection_date, technician_name,
            result_parameters, status, notes
        } = req.body;

        const report_id = await generateReportId();

        const { data, error } = await supabase
            .from('lab_reports')
            .insert([{
                report_id,
                patient_id,
                doctor_id,
                test_category,
                test_name,
                sample_type,
                department,
                collection_date,
                technician_name,
                result_parameters,
                status: status || 'Pending',
                notes
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error creating lab report:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

// Update Report
exports.updateReport = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabase
            .from('lab_reports')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating lab report:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete Report
exports.deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('lab_reports').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Report deleted successfully' });
    } catch (err) {
        console.error('Error deleting lab report:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getMyReports = async (req, res) => {
    try {
        const { userId } = req.params;

        // Find patient_id from user_id
        const { data: patient, error: pError } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (pError || !patient) {
            console.error('Patient not found for user:', userId);
            // Return empty array instead of 404 to handle new users gracefully
            return res.json([]);
        }

        const { data, error } = await supabase
            .from('lab_reports')
            .select(`
                *,
                doctors (
                    users (full_name)
                )
            `)
            .eq('patient_id', patient.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching my reports:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
