const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.get('/today', attendanceController.getTodayAttendance);
router.get('/all', attendanceController.getAllAttendance);
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.get('/active', attendanceController.getActiveStaff);
router.post('/apply-leave', attendanceController.applyLeave);
router.get('/history', attendanceController.getMyAttendance);
router.get('/leaves', attendanceController.getAllLeaves);
router.put('/leaves/status', attendanceController.updateLeaveStatus);
router.get('/staff-by-role', attendanceController.getStaffByRole);
router.put('/shifts', attendanceController.updateUserShift);
router.get('/my-leaves', attendanceController.getMyLeaves);
module.exports = router;
