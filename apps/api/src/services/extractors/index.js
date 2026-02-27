// Extractor registry — add new tools here without changing the controller
// Each extractor exports: extract(filePath, mime, options) → Promise<{ markdown, json, chunks }>
const localExtractor = require('./local.extractor');
const kreuzbergExtractor = require('./kreuzberg.extractor');

const EXTRACTORS = {
  local: localExtractor,
  kreuzberg: kreuzbergExtractor,
};

function getExtractor(tool = 'local') {
  if (!EXTRACTORS[tool]) {
    throw new Error(`Unknown extraction tool: "${tool}". Available: ${Object.keys(EXTRACTORS).join(', ')}`);
  }
  return EXTRACTORS[tool];
}

function listTools() {
  return Object.keys(EXTRACTORS);
}

module.exports = { getExtractor, listTools };
