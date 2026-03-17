const fs = require('fs');
const os = require('os');
const path = require('path');
const supabase = require('./supabase');

const BUCKET = process.env.SUPABASE_BUCKET || 'documents';

// All files live under cases/<caseId>/<storedName> in the bucket
function resolvePath(storedName, caseId) {
  if (!caseId) throw new Error(`caseId required for "${storedName}"`);
  return `cases/${caseId}/${storedName}`;
}

async function uploadFile(buffer, storedName, mimeType, storagePath) {
  if (!storagePath) throw new Error('storagePath required');
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

function getPublicUrl(_storedName, storagePath) {
  if (!storagePath) throw new Error('storagePath required');
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

async function downloadToTemp(storedName, caseId) {
  const storagePath = resolvePath(storedName, caseId);
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`Storage download failed: ${error.message}`);

  const tempDir = path.join(os.tmpdir(), 'doc-intel');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tempPath = path.join(tempDir, storedName);
  fs.writeFileSync(tempPath, Buffer.from(await data.arrayBuffer()));
  return tempPath;
}

async function deleteFile(storedName, caseId) {
  const storagePath = resolvePath(storedName, caseId);
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}

function cleanupTemp(tempPath) {
  try { if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
}

module.exports = {
  uploadFile,
  getPublicUrl,
  downloadToTemp,
  deleteFile,
  cleanupTemp,
};
