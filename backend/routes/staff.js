const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

router.get('/', staffController.getAllStaff);
router.post('/profile', staffController.createStaffProfile);
router.get('/:id', staffController.getStaffProfile);
router.put('/:id', staffController.updateStaffProfile);

module.exports = router;
