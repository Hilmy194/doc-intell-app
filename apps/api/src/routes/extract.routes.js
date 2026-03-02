const express = require('express');
const { handleExtract, listExtractTools } = require('../controllers/extract.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/', authMiddleware, handleExtract);
router.get('/tools', listExtractTools);

module.exports = router;
