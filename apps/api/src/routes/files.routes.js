const express = require('express');
const { listFiles, deleteFile } = require('../controllers/files.controller');

const router = express.Router();

router.get('/', listFiles);
router.delete('/:storedName', deleteFile);

module.exports = router;
