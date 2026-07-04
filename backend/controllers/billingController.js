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
            const { patient_name, ...inv } = r;
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
        const { patient_id, amount, status, date, items, subtotal, discount, tax_percentage, notes } = req.body;
        
        const safeSubtotal = subtotal !== undefined ? subtotal : amount;
        const safeTotal = amount;
        const safeDiscount = discount || 0;
        const safeTax = tax_percentage || 0;
        
        const safeDate = date ? new Date(date).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');

        const { rows } = await directDb.query(
            `INSERT INTO invoices (organization_id, patient_id, amount, subtotal, discount, tax_percentage, notes, status, created_at, invoice_number) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [orgId, patient_id, safeTotal, safeSubtotal, safeDiscount, safeTax, notes || '', status || 'Pending', safeDate, 'INV-' + Math.floor(Math.random() * 100000)]
        );

        const newInvoice = rows[0];

        if (items && Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                await directDb.query(
                    `INSERT INTO invoice_items (organization_id, invoice_id, description, quantity, unit_price, total_price)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [orgId, newInvoice.id, item.description, item.quantity, item.unit_price, item.total_price]
                );
            }
        }

        res.status(201).json(newInvoice);
    } catch (err) {
        console.error('Create invoice error:', err);
        res.status(500).json({ error: 'Server error creating invoice' });
    }
};

exports.getInvoiceDetails = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { id } = req.params;
        
        const invoiceRows = await safeQuery(
            `SELECT i.*, p.id as patient_id, u.full_name as patient_name
             FROM invoices i
             LEFT JOIN patients p ON i.patient_id = p.id
             LEFT JOIN users u ON p.user_id = u.id
             WHERE i.id = $1 AND i.organization_id = $2`,
            [id, orgId]
        );
        
        if (invoiceRows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
        
        const invoice = invoiceRows[0];
        
        const items = await safeQuery(
            `SELECT * FROM invoice_items WHERE invoice_id = $1 AND organization_id = $2 ORDER BY created_at ASC`,
            [id, orgId]
        );
        
        res.json({ ...invoice, items });
    } catch (err) {
        console.error('Get invoice details error:', err);
        res.status(500).json({ error: 'Server error fetching invoice details' });
    }
};

exports.updateInvoice = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { id } = req.params;
        const { amount, status, items, subtotal, discount, tax_percentage, notes } = req.body;
        
        const safeSubtotal = subtotal !== undefined ? subtotal : amount;
        const safeTotal = amount;
        const safeDiscount = discount || 0;
        const safeTax = tax_percentage || 0;
        
        await directDb.query(
            `UPDATE invoices 
             SET amount = $1, subtotal = $2, discount = $3, tax_percentage = $4, notes = $5, status = $6
             WHERE id = $7 AND organization_id = $8`,
            [safeTotal, safeSubtotal, safeDiscount, safeTax, notes || '', status, id, orgId]
        );
        
        if (items && Array.isArray(items)) {
            await directDb.query(`DELETE FROM invoice_items WHERE invoice_id = $1 AND organization_id = $2`, [id, orgId]);
            
            for (const item of items) {
                await directDb.query(
                    `INSERT INTO invoice_items (organization_id, invoice_id, description, quantity, unit_price, total_price)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [orgId, id, item.description, item.quantity, item.unit_price, item.total_price]
                );
            }
        }
        
        res.json({ message: 'Invoice updated successfully' });
    } catch (err) {
        console.error('Update invoice error:', err);
        res.status(500).json({ error: 'Server error updating invoice' });
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
            await directDb.query(`UPDATE invoices SET status = 'Paid' WHERE id = $1 AND organization_id = $2`, [invoice_id, orgId]);
        }

        res.status(201).json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error processing payment' });
    }
};
