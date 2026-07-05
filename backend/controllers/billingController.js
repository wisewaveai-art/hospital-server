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
        const userId = req.user?.id;
        const userRole = req.user?.role?.toLowerCase();
        
        let queryStr = `
            SELECT i.*, 
                   p.id as patient_id, 
                   u.full_name as patient_name
            FROM invoices i
            LEFT JOIN patients p ON i.patient_id = p.id
            LEFT JOIN users u ON p.user_id = u.id
            WHERE i.organization_id = $1
        `;
        const queryParams = [orgId];

        if (userRole === 'patient') {
            queryStr += ` AND u.id = $2`;
            queryParams.push(userId);
        }

        queryStr += ` ORDER BY i.created_at DESC`;
        
        const rows = await safeQuery(queryStr, queryParams);
        
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

exports.pharmacyCheckout = async (req, res) => {
    try {
        const orgId = req.organizationId;
        const { phone, full_name, cart, subtotal, discount, tax_percentage, total } = req.body;
        
        let patient_id = null;

        // 1. Resolve Patient
        if (phone) {
            // Check if patient exists
            const userCheck = await directDb.query(
                'SELECT u.id as user_id, p.id as patient_id FROM users u JOIN patients p ON u.id = p.user_id WHERE u.phone = $1 AND u.organization_id = $2 LIMIT 1',
                [phone, orgId]
            );
            if (userCheck.rows.length > 0) {
                patient_id = userCheck.rows[0].patient_id;
            } else {
                // Create user & patient
                const fakeEmail = `walkin_${Date.now()}@temp.com`;
                await directDb.query(
                    'INSERT INTO users (organization_id, full_name, email, phone, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
                    [orgId, full_name || 'Walk-in Patient', fakeEmail, phone, 'patient', 'no-password-walkin']
                );
                const userRes = await directDb.query('SELECT id FROM users WHERE phone = $1 AND organization_id = $2', [phone, orgId]);
                const newUserId = userRes.rows[0].id;

                const patRes = await directDb.query(
                    'INSERT INTO patients (user_id, organization_id, patient_type, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
                    [newUserId, orgId, 'Walk-in']
                );
                patient_id = patRes.rows[0].id;
            }
        } else {
            return res.status(400).json({ error: 'Phone number is required for billing' });
        }

        // 2. Validate Stock and Deduct
        for (const item of cart) {
            const medRes = await directDb.query('SELECT quantity FROM medicines WHERE id = $1 AND organization_id = $2', [item.id, orgId]);
            if (medRes.rows.length === 0 || medRes.rows[0].quantity < item.quantity) {
                return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
            }
            await directDb.query('UPDATE medicines SET quantity = quantity - $1 WHERE id = $2', [item.quantity, item.id]);
        }

        // 3. Create Invoice
        const invoiceNum = 'PHARM-' + Math.floor(Math.random() * 1000000);
        const { rows } = await directDb.query(
            `INSERT INTO invoices (organization_id, patient_id, amount, subtotal, discount, tax_percentage, notes, status, created_at, invoice_number) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9) RETURNING *`,
            [orgId, patient_id, total, subtotal, discount || 0, tax_percentage || 0, 'Pharmacy POS Purchase', 'Paid', invoiceNum]
        );
        const newInvoice = rows[0];

        // 4. Create Invoice Items
        for (const item of cart) {
            await directDb.query(
                `INSERT INTO invoice_items (organization_id, invoice_id, description, quantity, unit_price, total_price)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [orgId, newInvoice.id, item.name, item.quantity, item.price, item.quantity * item.price]
            );
        }

        res.status(201).json(newInvoice);
    } catch (err) {
        console.error('Pharmacy Checkout Error:', err);
        res.status(500).json({ error: 'Server error processing checkout' });
    }
};
