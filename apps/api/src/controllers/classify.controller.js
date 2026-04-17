const { getFileRecord } = require('../services/db.service');
const { listChunksByFile } = require('../services/chunks.db.service');
const { classifyDocument } = require('../services/classification.service');
const { getLatestClassificationByFile, saveClassification } = require('../services/classification.db.service');

async function runClassification(req, res) {
  const { storedName, force = false } = req.body || {};
  if (!storedName) {
    return res.status(400).json({ success: false, error: 'storedName is required' });
  }

  try {
    const file = await getFileRecord(storedName);
    if (!file) return res.status(404).json({ success: false, error: 'File not found' });

    const existing = await getLatestClassificationByFile(file.id);
    if (existing && !force) {
      return res.json({ success: true, data: { classification: existing, cached: true } });
    }

    const chunks = await listChunksByFile(file.id);
    const textSample = (chunks || []).slice(0, 3).map((c) => c.content).join('\n\n').slice(0, 3000);

    const result = await classifyDocument({
      filename: file.name,
      mime: file.mime,
      textSample,
    });

    const saved = await saveClassification({
      caseId: file.caseId,
      fileId: file.id,
      docType: result.docType,
      confidence: result.confidence,
      reasoning: result.reasoning,
      classifier: result.classifier,
      metadata: { storedName: file.storedName, mime: file.mime },
    });

    return res.json({ success: true, data: { classification: saved, cached: false } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  runClassification,
};
