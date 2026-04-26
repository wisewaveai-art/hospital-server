const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

// Public route to get settings (for homepage, login, etc)
router.get('/', settingsController.getSettings);

// Protected route to update settings (only admin should access this in real app)
// For now, checks are done in frontend or assumed admin usage via dashboard
router.put('/', settingsController.updateSettings);
router.get('/theme', settingsController.getTheme);
router.get('/themes/presets', settingsController.getPresets);
router.post('/theme', settingsController.updateTheme);

router.get('/:key', settingsController.getByKey);
router.post('/:key', settingsController.updateByKey);

module.exports = router;
