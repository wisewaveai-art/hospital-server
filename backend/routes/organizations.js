const express = require('express');
const router = express.Router();
const orgController = require('../controllers/organizationController');

router.get('/current', orgController.getCurrentOrganization);
router.get('/', orgController.getAll);
router.get('/:id', orgController.getById);
router.post('/', orgController.create);
router.put('/:id', orgController.update);

module.exports = router;
