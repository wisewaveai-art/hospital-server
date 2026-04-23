const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

router.get('/', doctorController.getAllDoctors);
router.post('/profile', doctorController.createDoctorProfile);
router.put('/:id', doctorController.updateDoctor);

module.exports = router;
