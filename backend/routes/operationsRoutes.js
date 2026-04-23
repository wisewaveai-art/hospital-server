const express = require('express');
const router = express.Router();
const { getOperations, createOperation } = require('../controllers/operationsController');

router.get('/', getOperations);
router.post('/', createOperation);

module.exports = router;
