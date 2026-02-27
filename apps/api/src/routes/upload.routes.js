const express = require('express');
const upload = require('../middlewares/multer');
const { handleUpload } = require('../controllers/upload.controller');

const router = express.Router();

router.post('/', upload.array('files', 20), handleUpload);

// Multer error handler
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File exceeds maximum size of 25 MB' });
  }
  if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Upload failed' });
});

module.exports = router;
