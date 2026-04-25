const directDb = require('../utils/directDb');

const safeQuery = async (queryStr, params = []) => {
    try {
        const { rows } = await directDb.query(queryStr, params);
        return rows;
    } catch (e) {
        console.warn('Billing Module Unmigrated or Query Failed:', e.message);
        return [];
    }
};

exports.getInvoices = async (req, res) => {
    try {
        const orgId = req.organizationId;
        
        let queryStr = `
            SELECT i.*, 
                   p.id as patient_id, 
                   u.full_name as patient_name
            FROM invoices i
            LEFT JOIN patients p ON i.patient_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            WHERE i.organization_id = $1
            ORDER BY i.created_at DESC
        `;
        
        const rows = await safeQuery(queryStr, [orgId]);
        
        const formatted = rows.map(r => {
            const { patient_id, patient_name, ...inv } = r;
            return {
                ...inv,
                patient: patient_name ? patient_name : 'Unknown',
                patients: { users: { full_name: patient_name } }
            };
        });

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching invoices' });
    }
};

exports.createInvoice = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { patient_id, amount, status, date } = req.body;
        
        const { rows } = await directDb.query(
            `INSERT INTO invoices (organization_id, patient_id, amount, status, created_at, invoice_number) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [orgId, patient_id, amount, status || 'Pending', date || new Date(), 'INV-' + Math.floor(Math.random() * 100000)]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error creating invoice' });
    }
};

exports.getPayments = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const rows = await safeQuery(
            `SELECT p.*, i.invoice_number 
             FROM payments p 
             LEFT JOIN invoices i ON p.invoice_id = i.id 
             WHERE p.organization_id = $1 ORDER BY p.payment_date DESC`,
            [orgId]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching payments' });
    }
};

exports.addPayment = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { invoice_id, amount, payment_method } = req.body;
        
        const { rows } = await directDb.query(
            `INSERT INTO payments (organization_id, invoice_id, amount, payment_method, payment_date) 
             VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
            [orgId, invoice_id, amount, payment_method]
        );

        if (rows[0]) {
            await directDb.query(`UPDATE invoices SET status = 'Paid' WHERE id = $1`, [invoice_id]);
        }

        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error processing payment' });
    }
};
