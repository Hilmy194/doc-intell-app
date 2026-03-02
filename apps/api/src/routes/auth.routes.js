const express = require('express');
const { handleLogin } = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', handleLogin);

module.exports = router;
