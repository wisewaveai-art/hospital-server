const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

router.post('/book', appointmentController.bookAppointment);
router.get('/my/:userId', appointmentController.getMyAppointments);
router.get('/doctor/:userId', appointmentController.getDoctorAppointments);
router.get('/all', appointmentController.getAllAppointments); // Admin/Doctor usage
router.get('/slots', appointmentController.getAvailableSlots);
router.put('/:id/status', appointmentController.updateStatus);
router.put('/:id/cancel', appointmentController.cancelAppointment);
router.post('/cancel-all', appointmentController.cancelAllAppointments);

module.exports = router;
