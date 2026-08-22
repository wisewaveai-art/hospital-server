const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// In a real app, you'd add middleware here to check if the requester is an Admin
router.get('/', userController.getAllUsers);
router.get('/assignable', userController.getAssignableUsers);
router.post('/', userController.createUser);
router.put('/:id/role', userController.updateUserRole);
router.put('/:id/status', userController.updateUserStatus);
router.put('/:id/password', userController.updatePassword);
router.put('/:id/profile-pic', userController.updateProfilePic);
router.delete('/:id', userController.deleteUser);

module.exports = router;
