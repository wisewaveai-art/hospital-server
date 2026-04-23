const supabase = require('../supabaseClient');
const { tenantQuery, withOrgData } = require('../utils/tenantQuery');

// Helper to generate Product Code (P1, P2, etc.)
async function generateProductCode(req) {
    const { data, error } = await tenantQuery('medicines', req)
        .select('product_code')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error generating code:', error);
        return 'P1';
    }

    if (!data || data.length === 0 || !data[0].product_code) return 'P1';

    const lastCode = data[0].product_code; // e.g., P5
    const numberPart = parseInt(lastCode.substring(1));
    if (isNaN(numberPart)) return 'P1';

    return `P${numberPart + 1}`;
}

// Get all medicines (Joined with Categories)
exports.getAllMedicines = async (req, res) => {
    try {
        const { data, error } = await tenantQuery('medicines', req)
            .select('*, categories(name)')
            .order('name', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching medicines:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get Low Stock Medicines
exports.getLowStockMedicines = async (req, res) => {
    try {
        const { data, error } = await tenantQuery('medicines', req)
            .select('*, categories(name)');

        if (error) throw error;

        const lowStock = data.filter(m => m.quantity <= (m.low_stock_threshold || 10));
        res.json(lowStock);
    } catch (err) {
        console.error('Error fetching low stock:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add new medicine
exports.addMedicine = async (req, res) => {
    try {
        const product_code = await generateProductCode(req);
        const medicineData = withOrgData({ ...req.body, product_code }, req);

        const { data, error } = await tenantQuery('medicines', req)
            .insert([medicineData])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error adding medicine:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update medicine
exports.updateMedicine = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = withOrgData(req.body, req);

        const { data, error } = await tenantQuery('medicines', req)
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error updating medicine:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete medicine
exports.deleteMedicine = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('medicines')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Medicine deleted successfully' });
    } catch (err) {
        console.error('Error deleting medicine:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
