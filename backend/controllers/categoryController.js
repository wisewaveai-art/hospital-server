const supabase = require('../supabaseClient');

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add category
exports.addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const { data, error } = await supabase
            .from('categories')
            .insert([{ name }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
