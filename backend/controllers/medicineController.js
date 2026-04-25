const directDb = require('../utils/directDb');

// Helper to generate Product Code (P1, P2, etc.)
async function generateProductCode(orgId) {
    let queryStr = 'SELECT product_code FROM medicines WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1';
    
    try {
        const { rows } = await directDb.query(queryStr, [orgId]);
        if (rows.length === 0 || !rows[0].product_code) return 'P1';

        const lastCode = rows[0].product_code; // e.g., P5
        const numberPart = parseInt(lastCode.substring(1));
        if (isNaN(numberPart)) return 'P1';

        return `P${numberPart + 1}`;
    } catch (e) {
        return 'P1';
    }
}

// Get all medicines (Joined with Categories)
exports.getAllMedicines = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const queryStr = `
            SELECT m.*, c.name as category_name 
            FROM medicines m 
            LEFT JOIN categories c ON m.category_id = c.id 
            WHERE m.organization_id = $1 
            ORDER BY m.name ASC
        `;
        const { rows } = await directDb.query(queryStr, [orgId]);
        
        // Emulate Supabase nested structure for frontend compatibility
        const formatted = rows.map(m => {
            const { category_name, ...rest } = m;
            return {
                ...rest,
                categories: { name: category_name }
            };
        });

        res.json(formatted);
    } catch (err) {
        console.error('Error fetching medicines:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get Low Stock Medicines
exports.getLowStockMedicines = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const queryStr = `
            SELECT m.*, c.name as category_name 
            FROM medicines m 
            LEFT JOIN categories c ON m.category_id = c.id 
            WHERE m.organization_id = $1 
        `;
        const { rows } = await directDb.query(queryStr, [orgId]);
        
        const lowStock = rows.map(m => {
            const { category_name, ...rest } = m;
            return {
                ...rest,
                categories: { name: category_name }
            };
        }).filter(m => m.quantity <= (m.low_stock_threshold || 10));

        res.json(lowStock);
    } catch (err) {
        console.error('Error fetching low stock:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add new medicine
exports.addMedicine = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const product_code = await generateProductCode(orgId);
        
        const m = req.body;
        const queryStr = `
            INSERT INTO medicines 
            (organization_id, product_code, name, generic_name, hsn_code, category_id, strength, unit, quantity, expiry_date, price_per_unit, batch_number, gst_percentage, low_stock_threshold) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
        `;
        const params = [
            orgId, product_code, m.name, m.generic_name, m.hsn_code, m.category_id || null, 
            m.strength, m.unit, m.quantity || 0, m.expiry_date || null, 
            m.price_per_unit || 0, m.batch_number, m.gst_percentage || 0, m.low_stock_threshold || 10
        ];

        const { rows } = await directDb.query(queryStr, params);
        res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error adding medicine:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update medicine
exports.updateMedicine = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        const updates = req.body;
        
        const columns = Object.keys(updates);
        if (columns.length === 0) return res.json({});

        const values = Object.values(updates);
        const setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(', ');
        
        const queryStr = `UPDATE medicines SET ${setClause} WHERE id = $${columns.length + 1} AND organization_id = $${columns.length + 2} RETURNING *`;
        const { rows } = await directDb.query(queryStr, [...values, id, orgId]);

        if (rows.length === 0) throw new Error("Update Failed or Not Found");
        res.json(rows[0]);
    } catch (err) {
        console.error('Error updating medicine:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete medicine
exports.deleteMedicine = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.organizationId;
        await directDb.query(`DELETE FROM medicines WHERE id = $1 AND organization_id = $2`, [id, orgId]);
        res.json({ message: 'Medicine deleted successfully' });
    } catch (err) {
        console.error('Error deleting medicine:', err);
        res.status(500).json({ error: 'Server error' });
    }
};
