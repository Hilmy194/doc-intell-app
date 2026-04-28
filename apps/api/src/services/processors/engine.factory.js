const doclingEngine = require('./engines/docling.engine');
const kreuzbergEngine = require('./engines/kreuzberg.engine');
const liteparseEngine = require('./engines/liteparse.engine');
const opendataloaderEngine = require('./engines/opendataloader.engine');
const { normalizeEngineName } = require('./helpers');

const ENGINES = {
  liteparse: liteparseEngine,
  docling: doclingEngine,
  kreuzberg: kreuzbergEngine,
  opendataloader_pdf: opendataloaderEngine,
};

const FALLBACK_MAP = {
  liteparse: 'docling',
  opendataloader_pdf: 'docling',
  kreuzberg: 'liteparse',
};

function getEngine(engineName = 'liteparse') {
  const normalized = normalizeEngineName(engineName);
  const engine = ENGINES[normalized];
  if (!engine) {
    throw new Error(
      `Unknown engine "${engineName}". Available engines: ${Object.keys(ENGINES).join(', ')}`
    );
  }
  return engine;
}

function getFallbackEngineName(engineName) {
  return FALLBACK_MAP[normalizeEngineName(engineName)] || null;
}

function listEngines() {
  return Object.keys(ENGINES);
}

module.exports = {
  getEngine,
  getFallbackEngineName,
  listEngines,
};
