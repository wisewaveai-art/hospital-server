const directDb = require('../utils/directDb');

exports.getCurrentOrganization = async (req, res) => {
    try {
        let orgId = req.organizationId;
        
        let queryStr = 'SELECT * FROM organizations WHERE slug = $1';
        let queryParams = ['main'];

        if (orgId) {
            queryStr = 'SELECT * FROM organizations WHERE id = $1';
            queryParams = [orgId];
        }

        const { rows } = await directDb.query(queryStr, queryParams);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Error in getCurrentOrganization:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAll = async (req, res) => {
    try {
        const { data, error } = await supabase.from('organizations').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.getById = async (req, res) => {
    try {
        const { data, error } = await supabase.from('organizations').select('*').eq('id', req.params.id).single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.create = async (req, res) => {
    try {
        const { data, error } = await supabase.from('organizations').insert([req.body]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, logo_url, primary_color, secondary_color, enabled_modules, settings } = req.body;
        const { data, error } = await supabase
            .from('organizations')
            .update({ name, logo_url, primary_color, secondary_color, enabled_modules, settings })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (err) { res.status(500).json({ error: 'Server error' }); }
};
