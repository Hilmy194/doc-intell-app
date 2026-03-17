const { listFileRecords, getFileRecord, deleteFileRecord } = require('../services/db.service');
const { deleteFile: deleteFromStorage } = require('../services/storage.service');

const listFiles = async (_req, res) => {
  try {
    const files = await listFileRecords();
    return res.json({ files });
  } catch (err) {
    console.error('listFiles error:', err.message);
    return res.status(500).json({ error: 'Failed to list files' });
  }
};

const deleteFile = async (req, res) => {
  const { storedName } = req.params;

  if (!storedName || storedName.includes('..')) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  try {
    // Fetch the record first so we know its caseId (determines storage path)
    const record = await getFileRecord(storedName);
    await deleteFromStorage(storedName, record?.caseId || null);
    await deleteFileRecord(storedName);
    return res.json({ success: true, storedName });
  } catch (err) {
    console.error('deleteFile error:', err.message);
    return res.status(500).json({ error: 'Failed to delete file' });
  }
};

module.exports = { listFiles, deleteFile };
