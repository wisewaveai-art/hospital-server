const express = require('express');
const router = express.Router();
const vibevoiceController = require('../controllers/vibevoiceController');

// Open Webhooks for VibeVoice - NO AUTH MIDDLEWARE needed if VibeVoice sends requests directly without token, 
// OR we can add a simple API Key check middleware if requested. For now, it's open for the AI webhook.
router.post('/book', vibevoiceController.bookAppointment);
router.post('/cancel', vibevoiceController.cancelAppointment);
router.get('/lookup', vibevoiceController.patientLookup);

module.exports = router;
