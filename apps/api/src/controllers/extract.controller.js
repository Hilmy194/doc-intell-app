const { v4: uuidv4 } = require('uuid');
const { getExtractor, listTools } = require('../services/extractors');
const { getFileRecord, updateFileRecord } = require('../services/db.service');
const { downloadToTemp, cleanupTemp } = require('../services/storage.service');

const handleExtract = async (req, res) => {
  const { storedName, mime, tool = 'kreuzberg', options = {} } = req.body;

  if (!storedName) {
    return res.status(400).json({ error: 'storedName is required' });
  }

  const record = await getFileRecord(storedName);
  if (!record) {
    return res.status(404).json({ error: 'File not found' });
  }

  let tempPath = null;

  try {
    tempPath = await downloadToTemp(storedName, record.caseId || null);

    const extractor = getExtractor(tool);
    const result = await extractor.extract(tempPath, mime || record.mime, options);

    await updateFileRecord(storedName, { extractStatus: 'done' }).catch(() => {});

    const metadata = {
      documentId: record.id || `doc_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
      extractor: tool,
      extractedAt: new Date().toISOString(),
      chunkCount: result.chunks ? result.chunks.length : 0,
      wordCount: result.wordCount || 0,
    };

    return res.json({ success: true, tool, ...result, ...metadata });
  } catch (err) {
    console.error('Extract error:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    cleanupTemp(tempPath);
  }
};

const listExtractTools = (_req, res) => {
  res.json({ tools: listTools() });
};

module.exports = { handleExtract, listExtractTools };
