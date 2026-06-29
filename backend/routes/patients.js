const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const patientController = require('../controllers/patientController');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.get('/', patientController.getAllPatients);
router.post('/profile', patientController.createPatientProfile);
router.get('/:id/details', patientController.getPatientDetails);
router.put('/:id', patientController.updatePatient);
router.patch('/:id/type', patientController.updatePatientType);
router.delete('/:id', patientController.deletePatient);
router.post('/visit', patientController.addVisitRecord);
router.post('/prescription', patientController.addPrescription);
router.post('/consultation', patientController.saveConsultation);
router.get('/id/:userId', patientController.getPatientIdByUserId);
router.post('/quick-add', patientController.quickAddPatient);

// PDF Reports
router.post('/:id/reports', upload.single('report_file'), patientController.uploadReport);
router.get('/:id/reports', patientController.getReports);

module.exports = router;
