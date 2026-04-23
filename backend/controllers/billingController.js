const { tenantQuery, withOrgData } = require('../utils/tenantQuery');

exports.getInvoices = async (req, res) => {
    try {
        const { data, error } = await tenantQuery('invoices', req)
            .select('*, patients(id, users(full_name))')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching invoices' });
    }
};

exports.createInvoice = async (req, res) => {
    try {
        const invoiceData = withOrgData(req.body, req);
        const { data, error } = await tenantQuery('invoices', req)
            .insert([invoiceData])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error creating invoice' });
    }
};

exports.getPayments = async (req, res) => {
    try {
        const { data, error } = await tenantQuery('payments', req)
            .select('*, invoices(invoice_number)')
            .order('payment_date', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error fetching payments' });
    }
};

exports.addPayment = async (req, res) => {
    try {
        const paymentData = withOrgData(req.body, req);
        const { data, error } = await tenantQuery('payments', req)
            .insert([paymentData])
            .select()
            .single();

        if (error) throw error;

        // Update invoice status if fully paid
        // (Logic for partial payments could be added here)
        await tenantQuery('invoices', req)
            .update({ status: 'paid' })
            .eq('id', paymentData.invoice_id);

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Server error processing payment' });
    }
};
