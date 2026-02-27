// Local extractor — lightweight built-in parsers, no external API
// Supports: PDF (pdf-parse), TXT, CSV, JSON, image placeholder
const fs = require('fs');
const path = require('path');

async function extract(filePath, mime, _options = {}) {
  const ext = path.extname(filePath).replace('.', '').toLowerCase();
  const filename = path.basename(filePath);

  if (mime === 'application/pdf' || ext === 'pdf') {
    return extractPdf(filePath, filename);
  }

  if (mime === 'text/plain' || ext === 'txt') {
    return extractText(filePath, filename);
  }

  if (mime === 'text/csv' || ext === 'csv') {
    return extractCsv(filePath, filename);
  }

  if (mime === 'application/json' || ext === 'json') {
    return extractJson(filePath, filename);
  }

  if (mime.startsWith('image/')) {
    return extractImage(filePath, filename);
  }

  // Office formats — placeholder for future integration
  return extractOfficePlaceholder(filename, ext);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────
async function extractPdf(filePath, filename) {
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    const lines = data.text?.split('\n').filter((l) => l.trim()) || [];
    const markdown = buildMarkdown(filename, lines);
    const chunks = buildChunks(lines, 300);

    return {
      tool: 'local',
      filename,
      pages: data.numpages,
      wordCount: data.text?.split(/\s+/).length || 0,
      markdown,
      json: {
        source: filename,
        pages: data.numpages,
        text: data.text,
        lines,
        chunks,
      },
      chunks,
    };
  } catch (err) {
    // pdf-parse not installed or corrupt PDF
    return fallbackResult(filename, `PDF parsing failed: ${err.message}`);
  }
}

// ─── Plain text ───────────────────────────────────────────────────────────────
async function extractText(filePath, filename) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n').filter((l) => l.trim());
  const chunks = buildChunks(lines, 300);
  return {
    tool: 'local',
    filename,
    pages: 1,
    wordCount: text.split(/\s+/).length,
    markdown: `# ${filename}\n\n` + text,
    json: { source: filename, lines, chunks },
    chunks,
  };
}

// ─── CSV ──────────────────────────────────────────────────────────────────────
async function extractCsv(filePath, filename) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n').filter((l) => l.trim());
  const headers = lines[0]?.split(',') || [];
  const rows = lines.slice(1).map((r) => r.split(','));

  const mdTable =
    `# ${filename}\n\n` +
    `| ${headers.join(' | ')} |\n` +
    `| ${headers.map(() => '---').join(' | ')} |\n` +
    rows.map((r) => `| ${r.join(' | ')} |`).join('\n');

  return {
    tool: 'local',
    filename,
    pages: 1,
    wordCount: rows.length,
    rowCount: rows.length,
    columnCount: headers.length,
    markdown: mdTable,
    json: { source: filename, headers, rows, totalRows: rows.length },
    chunks: [{ index: 0, text: text.slice(0, 2000), tokenEstimate: Math.round(text.length / 4) }],
  };
}

// ─── JSON ─────────────────────────────────────────────────────────────────────
async function extractJson(filePath, filename) {
  const text = fs.readFileSync(filePath, 'utf-8');
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = null; }

  const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
  const markdown =
    `# ${filename}\n\n` +
    '```json\n' + JSON.stringify(parsed, null, 2).slice(0, 4000) + '\n```';

  return {
    tool: 'local',
    filename,
    pages: 1,
    wordCount: text.split(/\s+/).length,
    markdown,
    json: { source: filename, parsed, topLevelKeys: keys },
    chunks: [{ index: 0, text: text.slice(0, 2000), tokenEstimate: Math.round(text.length / 4) }],
  };
}

// ─── Image ────────────────────────────────────────────────────────────────────
async function extractImage(filePath, filename) {
  const stats = fs.statSync(filePath);
  return {
    tool: 'local',
    filename,
    pages: 1,
    wordCount: 0,
    markdown: `# ${filename}\n\n> Image file — OCR extraction requires an AI tool (Landing AI, Azure DI).\n\n**File size:** ${(stats.size / 1024).toFixed(1)} KB`,
    json: { source: filename, type: 'image', size: stats.size },
    chunks: [],
  };
}

// ─── Office placeholder ───────────────────────────────────────────────────────
async function extractOfficePlaceholder(filename, ext) {
  return {
    tool: 'local',
    filename,
    pages: null,
    wordCount: null,
    markdown: `# ${filename}\n\n> **${ext.toUpperCase()} extraction** requires an integration with an AI tool.\n>\n> Supported providers:\n> - **Landing AI** (agentic document extraction)\n> - **Unstructured** (open-source pipeline)\n> - **Azure Document Intelligence**\n>\n> Configure the desired tool in \`apps/api/src/services/extractors/index.js\`.`,
    json: {
      source: filename,
      ext,
      status: 'pending_tool_configuration',
      message: 'Office format extraction requires external tool. See extractors/index.js.',
    },
    chunks: [],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildMarkdown(filename, lines) {
  let md = `# ${filename}\n\n`;
  let inParagraph = false;
  for (const line of lines) {
    if (line.length < 60 && line === line.toUpperCase() && line.trim().length > 2) {
      md += `\n## ${line}\n\n`;
      inParagraph = false;
    } else {
      md += line + '\n';
      inParagraph = true;
    }
  }
  return md;
}

function buildChunks(lines, maxTokens) {
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
    chunks.push({ index: idx, text: current.join('\n'), tokenEstimate: tokenCount });
  }
  return chunks;
}

function fallbackResult(filename, message) {
  return {
    tool: 'local',
    filename,
    pages: null,
    wordCount: null,
    markdown: `# ${filename}\n\n> ⚠️ ${message}`,
    json: { source: filename, error: message },
    chunks: [],
  };
}

module.exports = { extract };
