const supabase = require('../supabaseClient');

// Get all services
exports.getAllServices = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('services')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching services:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add new service
exports.addService = async (req, res) => {
    try {
        const { name, description, cost, status } = req.body;

        const { data, error } = await supabase
            .from('services')
            .insert([{ name, description, cost, status }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error adding service:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update service
exports.updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const { data, error } = await supabase
            .from('services')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating service:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete service
exports.deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('services')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Service deleted successfully' });
    } catch (err) {
        console.error('Error deleting service:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
