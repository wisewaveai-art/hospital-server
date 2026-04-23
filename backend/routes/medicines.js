const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');

router.get('/low-stock', medicineController.getLowStockMedicines);
router.get('/', medicineController.getAllMedicines);
router.post('/', medicineController.addMedicine);
router.put('/:id', medicineController.updateMedicine);
router.delete('/:id', medicineController.deleteMedicine);

module.exports = router;
