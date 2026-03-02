const express = require('express');
const { listFiles, deleteFile } = require('../controllers/files.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', listFiles);
router.delete('/:storedName', authMiddleware, deleteFile);

module.exports = router;
