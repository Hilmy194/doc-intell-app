const express = require('express');
const { handleLogin, handleRegister } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', handleLogin);
router.post('/register', handleRegister);

module.exports = router;
