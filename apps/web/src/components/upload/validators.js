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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Validate a single file against allowed extensions and max size.
 * Returns { valid: boolean, error?: string }
 */
export function validateFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type .${ext} is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds maximum size of 50 MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate an array of files. Returns array of { file, valid, error? }
 */
export function validateFiles(files) {
  return Array.from(files).map((file) => ({
    file,
    ...validateFile(file),
  }));
}
