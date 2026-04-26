const express = require('express');
const router = express.Router();
const ambulanceController = require('../controllers/ambulanceController');

router.get('/', ambulanceController.getAll);
router.post('/', ambulanceController.create);
router.put('/:id', ambulanceController.update);
router.delete('/:id', ambulanceController.delete);

module.exports = router;
