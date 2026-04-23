const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Define API route for AI prediction
router.post('/predict', aiController.predictDisease);

module.exports = router;
