// Supabase Storage operations — upload, download, delete files
const fs = require('fs');
const os = require('os');
const path = require('path');
const supabase = require('./supabase');

const BUCKET = process.env.SUPABASE_BUCKET || 'documents';

/**
 * Upload a file buffer to Supabase Storage under cases/<caseId>/<storedName>.
 * @param {Buffer} buffer
 * @param {string} storedName  - unique file name (used as temp/extract key)
 * @param {string} mimeType
 * @param {string} storagePath - full storage path (e.g. cases/<caseId>/<storedName>)
 */
async function uploadFile(buffer, storedName, mimeType, storagePath) {
  if (!storagePath) throw new Error('uploadFile: storagePath is required');

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
 * @param {string} storedName  - not used directly; kept for signature compat
 * @param {string} storagePath - full storage path
 */
function getPublicUrl(storedName, storagePath) {
  if (!storagePath) throw new Error('getPublicUrl: storagePath is required');
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Resolve the full storage path for a file inside its case folder.
 * All files are stored under cases/<caseId>/<storedName>.
 */
function resolvePath(storedName, caseId) {
  if (!caseId) throw new Error(`resolvePath: caseId is required for storedName "${storedName}"`);
  return `cases/${caseId}/${storedName}`;
}

/**
 * Download a file from Supabase to the OS temp directory.
 * Returns the local temp file path for processing.
 * @param {string} storedName
 * @param {string|null} [caseId] - pass caseId so the correct path is resolved
 */
async function downloadToTemp(storedName, caseId) {
  const storagePath = resolvePath(storedName, caseId);

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
 * @param {string} storedName
 * @param {string|null} [caseId] - pass caseId so the correct path is resolved
 */
async function deleteFile(storedName, caseId) {
  const storagePath = resolvePath(storedName, caseId);

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
