const fs = require('fs');
const { getFileRecord } = require('../services/db.service');
const { downloadToTemp, cleanupTemp } = require('../services/storage.service');
const { saveChunks, listChunksByFile, deleteChunksByFile } = require('../services/chunks.db.service');
const { getExtractor } = require('../services/extractors');

// POST /api/chunks/save  { storedName }
const handleSaveChunks = async (req, res) => {
  const { storedName, force } = req.body;
  if (!storedName) return res.status(400).json({ error: 'storedName is required' });

  const record = await getFileRecord(storedName);
  if (!record) return res.status(404).json({ error: 'File not found' });

  const existing = await listChunksByFile(record.id);
  if (existing.length > 0 && !force) {
    return res.json({ success: true, chunks: existing, count: existing.length, cached: true });
  }

  // Delete old chunks if re-chunking
  if (existing.length > 0 && force) {
    await deleteChunksByFile(record.id);
  }

  let tempPath = null;
  try {
    tempPath = await downloadToTemp(storedName, record.caseId);
    const chunks = await buildChunksFromFile(tempPath, record.mime, record);

    const saved = await saveChunks(record.id, record.caseId, chunks);
    return res.json({ success: true, chunks: saved, count: saved.length, cached: false });
  } catch (err) {
    console.error('Chunk save error:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    cleanupTemp(tempPath);
  }
};

// GET /api/chunks/:storedName
const handleListChunks = async (req, res) => {
  const { storedName } = req.params;
  const record = await getFileRecord(storedName);
  if (!record) return res.status(404).json({ error: 'File not found' });

  try {
    const chunks = await listChunksByFile(record.id);
    return res.json({ chunks, count: chunks.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// DELETE /api/chunks/:storedName
const handleDeleteChunks = async (req, res) => {
  const { storedName } = req.params;
  const record = await getFileRecord(storedName);
  if (!record) return res.status(404).json({ error: 'File not found' });

  try {
    await deleteChunksByFile(record.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── Split logic ──────────────────────────────────────────────────────────────

async function buildChunksFromFile(tempPath, mime, record) {
  const norm = (mime || '').toLowerCase();

  if (norm.includes('csv') || record.name?.endsWith('.csv')) {
    return splitCSV(tempPath);
  }
  if (norm.includes('json') || record.name?.endsWith('.json')) {
    return splitJSON(tempPath);
  }

  // For PDF, DOCX, images, etc. — run extractor to get text, then split
  try {
    const extractor = getExtractor('kreuzberg');
    const result = await extractor.extract(tempPath, mime);
    const fullText = result.json?.text || '';
    // Try record-aware splitting first (for structured lists like DTTOT)
    const recordChunks = splitByRecords(fullText);
    if (recordChunks) return recordChunks;
    return result.chunks || splitByTokens(fullText, 600);
  } catch {
    // Fallback: read as plain text
    const text = fs.readFileSync(tempPath, 'utf-8');
    const recordChunks = splitByRecords(text);
    if (recordChunks) return recordChunks;
    return splitByTokens(text, 600);
  }
}

function splitCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  const header = lines[0];
  return lines.slice(1).map((line, i) => ({
    index: i,
    text: `${header}\n${line}`,
    tokenEstimate: Math.round(line.length / 4),
  }));
}

function splitJSON(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    return splitByTokens(content, 300);
  }

  if (Array.isArray(parsed)) {
    return parsed.map((item, i) => {
      const text = JSON.stringify(item, null, 2);
      return { index: i, text, tokenEstimate: Math.round(text.length / 4) };
    });
  }

  const keys = Object.keys(parsed);
  return keys.map((key, i) => {
    const text = JSON.stringify({ [key]: parsed[key] }, null, 2);
    return { index: i, text, tokenEstimate: Math.round(text.length / 4) };
  });
}

function splitByRecords(text) {
  // Detect structured numbered entries: "1. Nama :", "2. Nama :", etc.
  const recordStarts = /^\s*\d+\.\s*Nama\s*:/m;
  if (!recordStarts.test(text)) return null;

  const lines = text.split('\n');
  const chunks = [];
  let current = [];
  let idx = 0;
  let sectionHeader = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers like "I. ENTITAS:" or "II. INDIVIDU:"
    if (/^[IVX]+\.\s+(INDIVIDU|ENTITAS)/i.test(trimmed)) {
      // Flush previous record
      if (current.length > 0) {
        const chunkText = current.join('\n').trim();
        if (chunkText) chunks.push({ index: idx++, text: chunkText, tokenEstimate: Math.round(chunkText.length / 4) });
        current = [];
      }
      sectionHeader = trimmed;
      continue;
    }

    // New numbered entry starts a new chunk
    if (/^\s*\d+\.\s*Nama\s*:/.test(line)) {
      if (current.length > 0) {
        const chunkText = current.join('\n').trim();
        if (chunkText) chunks.push({ index: idx++, text: chunkText, tokenEstimate: Math.round(chunkText.length / 4) });
        current = [];
      }
      // Prepend section header so AI knows if this is INDIVIDU or ENTITAS
      if (sectionHeader) current.push(sectionHeader);
    }

    if (trimmed) current.push(line);
  }

  // Flush last record
  if (current.length > 0) {
    const chunkText = current.join('\n').trim();
    if (chunkText) chunks.push({ index: idx++, text: chunkText, tokenEstimate: Math.round(chunkText.length / 4) });
  }

  if (chunks.length > 1) {
    console.log(`[chunks] Record-aware split: ${chunks.length} records detected`);
    return chunks;
  }

  return null; // Not enough records detected, fall back to token splitting
}

function splitByTokens(text, maxTokens = 600) {
  const lines = text.split('\n').filter((l) => l.trim());
  const chunks = [];
  let current = [];
  let tokenCount = 0;
  let idx = 0;

  for (const line of lines) {
    const tokens = Math.round(line.length / 4);
    if (tokenCount + tokens > maxTokens && current.length > 0) {
      chunks.push({ index: idx++, text: current.join('\n'), tokenEstimate: tokenCount });
      current = [];
      tokenCount = 0;
    }
    current.push(line);
    tokenCount += tokens;
  }
  if (current.length > 0) {
    chunks.push({ index: idx++, text: current.join('\n'), tokenEstimate: tokenCount });
  }
  return chunks;
}

module.exports = { handleSaveChunks, handleListChunks, handleDeleteChunks };
