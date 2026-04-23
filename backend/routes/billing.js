const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

router.get('/invoices', billingController.getInvoices);
router.post('/invoices', billingController.createInvoice);
router.get('/payments', billingController.getPayments);
router.post('/payments', billingController.addPayment);

module.exports = router;
