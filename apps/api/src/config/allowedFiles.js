const ALLOWED_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'docx',
  'xls',
  'xlsx',
  'pptx',
  'txt',
  'csv',
  'json',
];

const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  'application/octet-stream', // fallback for some uploads
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (matches UI)

module.exports = { ALLOWED_EXTENSIONS, ALLOWED_MIMETYPES, MAX_FILE_SIZE };

