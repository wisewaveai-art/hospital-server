const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

router.get('/', roomController.getAllRooms);
router.post('/', roomController.addRoom);
router.put('/:id', roomController.updateRoom);
router.post('/allocate', roomController.allocateRoom);
router.post('/discharge', roomController.dischargeRoom);
router.get('/:id/history', roomController.getRoomHistory);

router.delete('/:id', roomController.deleteRoom);

module.exports = router;
