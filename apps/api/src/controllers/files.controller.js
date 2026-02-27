// Files controller — list and delete files via Supabase
const { listFileRecords, deleteFileRecord } = require('../services/db.service');
const { deleteFile: deleteFromStorage } = require('../services/storage.service');

// GET /api/files — return all uploaded file records
const listFiles = async (_req, res) => {
  try {
    const files = await listFileRecords();
    return res.json({ files });
  } catch (err) {
    console.error('listFiles error:', err.message);
    return res.status(500).json({ error: 'Failed to list files' });
  }
};

// DELETE /api/files/:storedName — remove file from storage and database
const deleteFile = async (req, res) => {
  const { storedName } = req.params;

  if (!storedName || storedName.includes('..')) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  try {
    await deleteFromStorage(storedName);
    await deleteFileRecord(storedName);
    return res.json({ success: true, storedName });
  } catch (err) {
    console.error('deleteFile error:', err.message);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
};

module.exports = { listFiles, deleteFile };
