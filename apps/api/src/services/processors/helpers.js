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

function buildParseResult({ markdown = '', text = '', pages = [], metadata = {}, layout = null } = {}) {
  return {
    markdown: typeof markdown === 'string' ? markdown : '',
    text: typeof text === 'string' ? text : '',
    pages: Array.isArray(pages) ? pages : [],
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    layout: layout || null,
  };
}

function buildExtractResult({ json = {}, fields = [], confidence = {}, metadata = {} } = {}) {
  return {
    json: json && typeof json === 'object' ? json : {},
    fields: Array.isArray(fields) ? fields : [],
    confidence: confidence && typeof confidence === 'object' ? confidence : {},
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  };
}

function buildSplitResult({ chunks = [], segments = [], page_ranges = [], metadata = {} } = {}) {
  return {
    chunks: Array.isArray(chunks) ? chunks : [],
    segments: Array.isArray(segments) ? segments : [],
    page_ranges: Array.isArray(page_ranges) ? page_ranges : [],
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
  };
}

function defaultSchema() {
  return {
    fields: [
      { name: 'title', type: 'string', description: 'Document title', required: false },
      { name: 'date', type: 'date', description: 'Relevant date', required: false },
      { name: 'amount', type: 'number', description: 'Total amount or value', required: false },
    ],
  };
}

function normalizeSchema(schema = {}) {
  if (!schema || typeof schema !== 'object') return defaultSchema();
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  if (fields.length === 0) return defaultSchema();
  return { fields };
}

function extractBySchema(text = '', schema = {}) {
  const normalized = normalizeSchema(schema);
  const content = String(text || '');
  const lines = content.split('\n');

  const json = {};
  const fields = [];
  const confidence = {};

  for (const field of normalized.fields) {
    const name = String(field.name || '').trim();
    if (!name) continue;

    const matchLine = lines.find((l) => l.toLowerCase().includes(name.toLowerCase()));
    let value = '';
    if (matchLine) {
      const parts = matchLine.split(':');
      if (parts.length > 1) value = parts.slice(1).join(':').trim();
      else value = matchLine.trim();
    }

    json[name] = value || null;
    fields.push({
      name,
      type: field.type || 'string',
      description: field.description || '',
      required: Boolean(field.required),
      value: value || null,
    });
    confidence[name] = value ? 0.65 : 0.1;
  }

  return { json, fields, confidence, schema: normalized };
}

function normalizePages(pages) {
  if (Array.isArray(pages)) {
    return pages.map((p, idx) => {
      if (typeof p === 'string') return { page: idx + 1, text: p };
      if (p && typeof p === 'object') {
        return { page: Number(p.page || idx + 1), text: String(p.text || '') };
      }
      return { page: idx + 1, text: '' };
    });
  }
  if (Number.isFinite(pages)) {
    return Array.from({ length: Math.max(1, Number(pages)) }).map((_, i) => ({ page: i + 1, text: '' }));
  }
  return [];
}

function splitByStrategy(text = '', pages = [], options = {}) {
  const strategy = String(options.strategy || 'chunk').toLowerCase();
  if (strategy === 'page' && pages.length > 0) {
    const segments = pages.map((p) => ({
      index: p.page,
      text: p.text || '',
      page_range: [p.page, p.page],
    }));
    return { segments, page_ranges: segments.map((s) => s.page_range) };
  }
  if (strategy === 'heading') {
    const lines = String(text || '').split('\n');
    const segments = [];
    let current = [];
    let idx = 0;
    for (const line of lines) {
      const isHeading = line.trim().startsWith('#');
      if (isHeading && current.length > 0) {
        segments.push({ index: idx++, text: current.join('\n'), page_range: [] });
        current = [];
      }
      current.push(line);
    }
    if (current.length > 0) segments.push({ index: idx++, text: current.join('\n'), page_range: [] });
    return { segments, page_ranges: [] };
  }

  const chunks = chunkText(text, options);
  const segments = chunks.map((c) => ({ index: c.index, text: c.text, page_range: [] }));
  return { segments, page_ranges: [] };
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
  defaultSchema,
  normalizeSchema,
  extractBySchema,
  normalizePages,
  splitByStrategy,
  buildParseResult,
  buildExtractResult,
  buildSplitResult,
};
