const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const SCRIPT_PATH = path.join(__dirname, '..', '..', '..', 'scripts', 'docling_extract.py');
const PYTHON_CMD = process.env.PYTHON_PATH || 'python';

async function extract(filePath, mime, _options = {}) {
  const filename = path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const result = await runDocling(filePath, mime);

  if (result.error) {
    throw new Error(`Docling extraction failed: ${result.error}`);
  }

  const text = result.text || '';
  const tables = result.tables || [];
  const lines = text.split('\n').filter((l) => l.trim());
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const chunks = buildChunks(lines, tables, 300);

  const markdown = result.markdown || buildMarkdown(filename, lines, tables);

  return {
    tool: 'docling',
    filename,
    pages: result.pages || estimatePages(text),
    wordCount,
    markdown,
    json: {
      source: filename,
      text,
      lines,
      chunks,
      tables,
      metadata: result.metadata || {},
    },
    chunks,
  };
}

function runDocling(filePath, mime) {
  const args = [SCRIPT_PATH, filePath];
  if (mime) args.push(mime);
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON_CMD,
      args,
      { timeout: 120_000, maxBuffer: 50 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } },
      (err, stdout, stderr) => {
        if (err) {
          if (err.killed) {
            return reject(new Error('Docling extraction timed out (120s)'));
          }
          try {
            const parsed = JSON.parse(stdout);
            if (parsed.error) return reject(new Error(parsed.error));
          } catch {}
          return reject(new Error(`Docling process error: ${stderr || err.message}`));
        }

        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch {
          reject(new Error(`Failed to parse Docling output: ${stdout.slice(0, 200)}`));
        }
      }
    );
  });
}

function buildMarkdown(filename, lines, tables = []) {
  let md = `# ${filename}\n\n`;
  for (const line of lines) {
    if (line.length < 60 && line === line.toUpperCase() && line.trim().length > 2) {
      md += `\n## ${line}\n\n`;
    } else {
      md += line + '\n';
    }
  }
  if (tables.length > 0) {
    md += `\n\n## Extracted Tables\n\n`;
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const pageLabel = t.page != null ? ` (page ${t.page})` : '';
      md += `### Table ${i + 1}${pageLabel}\n\n${t.markdown}\n\n`;
    }
  }
  return md;
}

function buildChunks(lines, tables = [], maxTokens = 300) {
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
  for (const t of tables) {
    const pageLabel = t.page != null ? ` [page ${t.page}]` : '';
    chunks.push({
      index: idx++,
      text: `[TABLE${pageLabel}]\n${t.markdown}`,
      tokenEstimate: Math.round((t.markdown || '').length / 4),
      isTable: true,
    });
  }
  return chunks;
}

function estimatePages(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 3000));
}

module.exports = { extract };
