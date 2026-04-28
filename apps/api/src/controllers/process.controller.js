const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { processDocument, listEngines } = require('../services/processors/process.service');
const { getFileRecord, updateFileRecord } = require('../services/db.service');
const { downloadToTemp, cleanupTemp } = require('../services/storage.service');

function safeJsonParse(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function normalizeOptions(input = {}) {
  const options = { ...input };

  if (options.chunk_size != null) options.chunk_size = Number(options.chunk_size);
  if (options.chunk_overlap != null) options.chunk_overlap = Number(options.chunk_overlap);
  if (options.use_ocr != null) {
    options.use_ocr = String(options.use_ocr).toLowerCase() === 'true' || options.use_ocr === true;
  }
  if (options.output_format != null) options.output_format = String(options.output_format).toLowerCase();
  if (options.fallback_engine != null) options.fallback_engine = String(options.fallback_engine).toLowerCase();

  return options;
}

async function resolveInputFile(req) {
  const storedName = req.body?.storedName;
  const mimeFromBody = req.body?.mime || '';

  if (req.file) {
    const ext = path.extname(req.file.originalname || '');
    const tmpName = `process-${Date.now()}-${uuidv4().slice(0, 8)}${ext}`;
    const tempDir = path.join(os.tmpdir(), 'doc-intel-process');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, tmpName);
    fs.writeFileSync(tempPath, req.file.buffer);

    return {
      tempPath,
      cleanup: true,
      mime: req.file.mimetype || mimeFromBody,
      source: req.file.originalname || tmpName,
      storedName: null,
    };
  }

  if (!storedName) {
    throw new Error('Either multipart file field "file" or storedName is required');
  }

  const record = await getFileRecord(storedName);
  if (!record) {
    throw new Error('File not found for provided storedName');
  }

  const tempPath = await downloadToTemp(storedName, record.caseId || null);
  return {
    tempPath,
    cleanup: true,
    mime: mimeFromBody || record.mime,
    source: record.name || storedName,
    storedName,
  };
}

async function handleProcess(req, res) {
  const engine = (req.body?.engine || 'liteparse').toLowerCase();
  const mode = (req.body?.mode || 'parse').toLowerCase();
  const rawOptions = safeJsonParse(req.body?.options, req.body?.options || {});
  const options = normalizeOptions(rawOptions);

  let fileCtx = null;

  try {
    fileCtx = await resolveInputFile(req);
    const result = await processDocument({
      engineName: engine,
      mode,
      filePath: fileCtx.tempPath,
      options: {
        ...options,
        mime: fileCtx.mime,
      },
    });

    if (fileCtx.storedName) {
      await updateFileRecord(fileCtx.storedName, { extractStatus: 'done' }).catch(() => {});
    }

    return res.json({
      status: 'success',
      engine: result.metadata.engine,
      mode,
      source: fileCtx.source,
      result,
    });
  } catch (err) {
    console.error('[process] error:', err.message);
    return res.status(400).json({
      status: 'error',
      error: err.message,
    });
  } finally {
    if (fileCtx?.cleanup && fileCtx?.tempPath) {
      cleanupTemp(fileCtx.tempPath);
    }
  }
}

function listProcessingEngines(_req, res) {
  return res.json({
    engines: listEngines(),
    modes: ['parse', 'extract', 'split'],
  });
}

module.exports = {
  handleProcess,
  listProcessingEngines,
};
