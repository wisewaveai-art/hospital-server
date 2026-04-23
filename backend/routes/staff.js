const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/', staffController.getAllStaff);
router.post('/profile', staffController.createStaffProfile);

module.exports = router;
