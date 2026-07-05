const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

router.get('/invoices', billingController.getInvoices);
router.post('/invoices', billingController.createInvoice);
router.get('/invoices/:id', billingController.getInvoiceDetails);
router.put('/invoices/:id', billingController.updateInvoice);
router.get('/payments', billingController.getPayments);
router.post('/payments', billingController.addPayment);
router.post('/pharmacy-checkout', billingController.pharmacyCheckout);

module.exports = router;
