const express = require('express');
const router = express.Router();
const instrumentsController = require('../controllers/instrumentsController');

router.get('/', instrumentsController.getAllInstruments);
router.post('/', instrumentsController.addInstrument);
router.put('/:id', instrumentsController.updateInstrument);
router.delete('/:id', instrumentsController.deleteInstrument);

module.exports = router;
