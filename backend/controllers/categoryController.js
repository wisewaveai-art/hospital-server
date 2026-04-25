const directDb = require('../utils/directDb');

// Get all categories
exports.getAllCategories = async (req, res) => {
    try {
        const { rows } = await directDb.query(
            'SELECT * FROM categories ORDER BY name ASC'
        );
        res.json(rows);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add category
exports.addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const { rows } = await directDb.query(
            'INSERT INTO categories (name) VALUES ($1) RETURNING *',
            [name]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error adding category:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
