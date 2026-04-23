const supabase = require('../supabaseClient');

const getOperations = async (req, res) => {
    try {
        const { role, userId } = req.query;

        console.log('Fetching operations for role:', role);
        let query = supabase.from('operations').select('*, patient:patients(id, users!patients_user_id_fkey(full_name)), doctor:users(full_name)');

        // If patient, filter by patient_id
        if (role === 'patient' && userId) {
            query = query.eq('patient_id', userId);
        }
        // If doctor, filter by doctor_id
        else if (role === 'doctor' && userId) {
            query = query.eq('doctor_id', userId);
        }
        // If admin, maybe show all upcoming?
        else if (role === 'admin') {
            // No filter needed, or maybe sort by date
            query = query.order('operation_date', { ascending: true });
        }

        const { data, error } = await query;

        if (data) {
            data.forEach(op => {
                if (op.patient && op.patient.users) {
                    // Handle both single object (One-to-One) and array (if inferred differently)
                    const userObj = Array.isArray(op.patient.users) ? op.patient.users[0] : op.patient.users;
                    op.patient.full_name = userObj?.full_name || 'Unknown';
                }
            });
        }

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching operations:', error);
        res.status(500).json({ error: error.message });
    }
};

const createOperation = async (req, res) => {
    try {
        const { patient_id, doctor_id, operation_name, operation_date, notes } = req.body;
        const { data, error } = await supabase
            .from('operations')
            .insert([{ patient_id, doctor_id, operation_name, operation_date, notes }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    getOperations,
    createOperation
};
