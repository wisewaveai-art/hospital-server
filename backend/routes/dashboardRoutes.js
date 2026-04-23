const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/stats', dashboardController.getAdminStats);
router.get('/operations-overview', dashboardController.getOperationalOverview);

module.exports = router;
