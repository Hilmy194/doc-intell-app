const express = require('express');
const upload = require('../middlewares/multer');
const authMiddleware = require('../middlewares/auth.middleware');
const {
  handleProcess,
  listProcessingEngines,
} = require('../controllers/process.controller');

const router = express.Router();

router.post('/', authMiddleware, upload.single('file'), handleProcess);
router.get('/engines', listProcessingEngines);

router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ status: 'error', error: 'File exceeds maximum size of 50 MB' });
  }
  if (err.message) {
    return res.status(400).json({ status: 'error', error: err.message });
  }
  return res.status(500).json({ status: 'error', error: 'Processing failed' });
});

module.exports = router;
