const express = require('express');
const { handleExtract, listExtractTools } = require('../controllers/extract.controller');

const router = express.Router();

router.post('/', handleExtract);
router.get('/tools', listExtractTools);

module.exports = router;
