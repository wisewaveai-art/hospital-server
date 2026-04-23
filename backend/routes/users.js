const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// In a real app, you'd add middleware here to check if the requester is an Admin
router.get('/', userController.getAllUsers);
router.put('/:id/role', userController.updateUserRole);
router.put('/:id/profile-pic', userController.updateProfilePic);

module.exports = router;
