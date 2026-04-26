const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');

router.get('/employees', hrController.getEmployees);
router.get('/payroll', hrController.getPayrollHistory);
router.post('/payroll/process', hrController.processPayroll);
router.get('/leaves', hrController.getLeaveRequests);
router.put('/leaves/:id', hrController.updateLeaveStatus);

module.exports = router;
