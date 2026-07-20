const express = require('express');
const router = express.Router();
const { getOperations, createOperation, updateOperationStatus } = require('../controllers/operationsController');

router.get('/', getOperations);
router.post('/', createOperation);
router.put('/:id/status', updateOperationStatus);

module.exports = router;
