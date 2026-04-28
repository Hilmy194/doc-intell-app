const fs = require('fs');
const path = require('path');

function normalizeEngineName(name = 'liteparse') {
  return String(name || 'liteparse').trim().toLowerCase();
}

function normalizeMode(mode = 'parse') {
  return String(mode || 'parse').trim().toLowerCase();
}

function ensureStandardResult(result = {}, metadataPatch = {}) {
  const metadata = {
    engine: result?.metadata?.engine || metadataPatch.engine || '',
    processing_time: Number(result?.metadata?.processing_time || metadataPatch.processing_time || 0),
    fallback: result?.metadata?.fallback ?? metadataPatch.fallback ?? null,
    warnings: Array.isArray(result?.metadata?.warnings)
      ? result.metadata.warnings
      : Array.isArray(metadataPatch.warnings)
        ? metadataPatch.warnings
        : [],
    attempted_engines: Array.isArray(result?.metadata?.attempted_engines)
      ? result.metadata.attempted_engines
      : Array.isArray(metadataPatch.attempted_engines)
        ? metadataPatch.attempted_engines
        : [],
  };

  return {
    text: typeof result?.text === 'string' ? result.text : '',
    markdown: typeof result?.markdown === 'string' ? result.markdown : '',
    json: result?.json && typeof result.json === 'object' ? result.json : {},
    chunks: Array.isArray(result?.chunks) ? result.chunks : [],
    metadata,
  };
}

function estimateTokenCount(text = '') {
  if (!text) return 0;
  return Math.max(1, Math.round(String(text).length / 4));
}

function chunkText(text = '', options = {}) {
  const clean = String(text || '');
  if (!clean.trim()) return [];

  const chunkSize = Math.max(200, Number(options.chunk_size || 900));
  const overlap = Math.max(0, Number(options.chunk_overlap || 120));
  const safeOverlap = Math.min(overlap, chunkSize - 50);

  const lines = clean.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const line of lines) {
    const lineLen = line.length + 1;
    if (currentLen + lineLen > chunkSize && current.length > 0) {
      const joined = current.join('\n');
      chunks.push({
        index: chunks.length,
        text: joined,
        tokenEstimate: estimateTokenCount(joined),
      });

      if (safeOverlap > 0) {
        const tail = joined.slice(Math.max(0, joined.length - safeOverlap));
        current = [tail, line];
        currentLen = tail.length + lineLen;
      } else {
        current = [line];
        currentLen = lineLen;
      }
      continue;
    }

    current.push(line);
    currentLen += lineLen;
  }

  if (current.length > 0) {
    const joined = current.join('\n');
    chunks.push({
      index: chunks.length,
      text: joined,
      tokenEstimate: estimateTokenCount(joined),
    });
  }

  return chunks;
}

function resolveFileInfo(filePath, mime = '') {
  const ext = path.extname(filePath || '').replace('.', '').toLowerCase();
  return {
    fileName: path.basename(filePath || ''),
    ext,
    mime: String(mime || '').toLowerCase(),
  };
}

function readUtf8IfTextLike(filePath, mime = '') {
  const { ext } = resolveFileInfo(filePath, mime);
  const textExt = ['txt', 'md', 'csv', 'json', 'xml', 'html'];
  const textMime = ['text/', 'application/json', 'application/xml'];
  const mimeLower = String(mime || '').toLowerCase();
  const isTextExt = textExt.includes(ext);
  const isTextMime = textMime.some((prefix) => mimeLower.startsWith(prefix));

  if (!isTextExt && !isTextMime) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

module.exports = {
  normalizeEngineName,
  normalizeMode,
  ensureStandardResult,
  chunkText,
  resolveFileInfo,
  readUtf8IfTextLike,
};
