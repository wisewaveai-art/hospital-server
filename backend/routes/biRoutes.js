const express = require('express');
const router = express.Router();
const biController = require('../controllers/biController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/analytics', biController.getGeneralAnalytics);
router.get('/stocks', biController.getStockAnalytics);
router.get('/finance', biController.getFinancialAnalytics);
router.post('/expenses', biController.addExpense);

module.exports = router;
