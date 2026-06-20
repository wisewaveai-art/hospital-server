const express = require('express');
const router = express.Router();
const vitalsController = require('../controllers/vitalsController');
const auth = require('../middleware/authMiddleware');

// Note: Both nurses and doctors should be able to record vitals
router.post('/', auth, vitalsController.recordVitals);

// Everyone (including patient themselves) can read vitals
router.get('/patient/:patientId', auth, vitalsController.getPatientVitals);

module.exports = router;
