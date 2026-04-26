const express = require('express');
const router = express.Router();
const diagnosticLabController = require('../controllers/diagnosticLabController');

router.get('/', diagnosticLabController.getAll);
router.post('/', diagnosticLabController.create);
router.put('/:id', diagnosticLabController.update);
router.delete('/:id', diagnosticLabController.delete);

module.exports = router;
