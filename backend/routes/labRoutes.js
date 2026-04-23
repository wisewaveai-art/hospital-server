const express = require('express');
const router = express.Router();
const labController = require('../controllers/labController');

router.get('/', labController.getAllReports);
router.post('/', labController.createReport);
router.put('/:id', labController.updateReport);
router.delete('/:id', labController.deleteReport);
router.get('/my/:userId', labController.getMyReports);

module.exports = router;
