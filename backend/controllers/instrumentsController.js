const supabase = require('../supabaseClient');

// Get all instruments
exports.getAllInstruments = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('instruments')
            .select('*')
            .order('next_service_date', { ascending: true }); // Show those needing service soon first

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching instruments:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add new instrument
exports.addInstrument = async (req, res) => {
    try {
        const { name, purchase_date, next_service_date, warranty_expiry, status } = req.body;

        const { data, error } = await supabase
            .from('instruments')
            .insert([{ name, purchase_date, next_service_date, warranty_expiry, status }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error adding instrument:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update instrument
exports.updateInstrument = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabase
            .from('instruments')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating instrument:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete instrument
exports.deleteInstrument = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('instruments')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Instrument deleted successfully' });
    } catch (err) {
        console.error('Error deleting instrument:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
