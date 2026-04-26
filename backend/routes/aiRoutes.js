const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Define API route for AI prediction
router.post('/predict', aiController.predictDisease);
router.post('/track-flow', aiController.trackFlow);

module.exports = router;
