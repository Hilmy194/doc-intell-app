// Multer config — memory storage for cloud deployment (Supabase)
const multer = require('multer');
const path = require('path');
const { ALLOWED_EXTENSIONS, ALLOWED_MIMETYPES, MAX_FILE_SIZE } = require('../config/allowedFiles');

// Store files in memory buffer; uploaded to Supabase in the controller
const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).replace('.', '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Extension .${ext} is not allowed`), false);
  }

  if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
    return cb(new Error(`MIME type ${file.mimetype} is not allowed`), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = upload;
