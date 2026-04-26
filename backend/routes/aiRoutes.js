const express = require('express');
const router = express.Router();
const hospitalAIController = require('../controllers/hospitalAIController');

router.get('/predict/:patientId', hospitalAIController.getPatientPrediction);
router.post('/predict', hospitalAIController.handleGenericPredict);

module.exports = router;
