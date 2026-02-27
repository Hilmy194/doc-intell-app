// Extraction controller — downloads file from Supabase, runs extractor, cleans up
const { getExtractor, listTools } = require('../services/extractors');
const { getFileRecord, updateFileRecord } = require('../services/db.service');
const { downloadToTemp, cleanupTemp } = require('../services/storage.service');

// POST /api/extract — extract content from an uploaded file
const handleExtract = async (req, res) => {
  const { storedName, mime, tool = 'local', options = {} } = req.body;

  if (!storedName) {
    return res.status(400).json({ error: 'storedName is required' });
  }

  // Verify file exists in the database
  const record = await getFileRecord(storedName);
  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  let tempPath = null;

  try {
    // Download from Supabase to a temp file for processing
    tempPath = await downloadToTemp(storedName);

    const extractor = getExtractor(tool);
    const result = await extractor.extract(tempPath, mime || record.mime, options);

    // Mark extraction as done
    await updateFileRecord(storedName, { extractStatus: 'done' }).catch(() => {});

    return res.json({ success: true, tool, ...result });
  } catch (err) {
    console.error('Extract error:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    cleanupTemp(tempPath);
  }
};

// GET /api/extract/tools — list available extractors
const listExtractTools = (_req, res) => {
  res.json({ tools: listTools() });
};

module.exports = { handleExtract, listExtractTools };
