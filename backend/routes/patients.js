const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

router.get('/', patientController.getAllPatients);
router.post('/profile', patientController.createPatientProfile);
router.get('/:id/details', patientController.getPatientDetails);
router.put('/:id', patientController.updatePatient);
router.delete('/:id', patientController.deletePatient);
router.post('/visit', patientController.addVisitRecord);
router.post('/prescription', patientController.addPrescription);
router.get('/id/:userId', patientController.getPatientIdByUserId);
router.post('/quick-add', patientController.quickAddPatient);

module.exports = router;
