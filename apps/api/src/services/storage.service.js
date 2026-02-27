// Supabase Storage operations — upload, download, delete files
const fs = require('fs');
const os = require('os');
const path = require('path');
const supabase = require('./supabase');

const BUCKET = process.env.SUPABASE_BUCKET || 'documents';

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the storage path used as the key.
 */
async function uploadFile(buffer, storedName, mimeType) {
  const storagePath = `uploads/${storedName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

/**
 * Get the public URL for a file in storage.
 */
function getPublicUrl(storedName) {
  const storagePath = `uploads/${storedName}`;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Download a file from Supabase to the OS temp directory.
 * Returns the local temp file path for processing.
 */
async function downloadToTemp(storedName) {
  const storagePath = `uploads/${storedName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error) throw new Error(`Storage download failed: ${error.message}`);

  const tempDir = path.join(os.tmpdir(), 'doc-intel');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempPath = path.join(tempDir, storedName);
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(tempPath, buffer);

  return tempPath;
}

/**
 * Delete a file from Supabase Storage.
 */
async function deleteFile(storedName) {
  const storagePath = `uploads/${storedName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

/**
 * Remove a temp file after processing.
 */
function cleanupTemp(tempPath) {
  try {
    if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  } catch {
    // Non-critical — temp files are cleaned by OS eventually
  }
}

module.exports = {
  uploadFile,
  getPublicUrl,
  downloadToTemp,
  deleteFile,
  cleanupTemp,
};
