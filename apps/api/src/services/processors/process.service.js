const { getEngine, getFallbackEngineName, listEngines } = require('./engine.factory');
const { ensureStandardResult, normalizeEngineName, normalizeMode } = require('./helpers');

function buildAttemptOrder(requestedEngine, options = {}) {
  const requested = normalizeEngineName(requestedEngine);
  const customFallback = normalizeEngineName(options.fallback_engine || '');
  const ordered = [];

  const pushUnique = (name) => {
    if (!name) return;
    if (!listEngines().includes(name)) return;
    if (!ordered.includes(name)) ordered.push(name);
  };

  pushUnique(requested);
  if (customFallback && customFallback !== requested) {
    pushUnique(customFallback);
  }

  let cursor = requested;
  while (cursor) {
    const next = getFallbackEngineName(cursor);
    if (!next) break;
    pushUnique(next);
    cursor = next;
  }

  return ordered;
}

async function executeByMode(engine, mode, filePath, options = {}) {
  if (mode === 'extract') {
    return engine.extract(filePath, options.schema || {}, { mime: options.mime, options });
  }
  if (mode === 'split') {
    return engine.split(filePath, { mime: options.mime, options });
  }
  return engine.parse(filePath, { mime: options.mime, options });
}

async function processDocument({ engineName, mode, filePath, options = {} }) {
  const normalizedMode = normalizeMode(mode);
  const allowedModes = ['parse', 'extract', 'split'];
  if (!allowedModes.includes(normalizedMode)) {
    throw new Error(`Invalid mode "${mode}". Allowed: ${allowedModes.join(', ')}`);
  }

  const attempts = buildAttemptOrder(engineName, options);
  if (attempts.length === 0) {
    throw new Error('No processing engines are available');
  }

  const startedAt = Date.now();
  const errors = [];

  for (const attemptName of attempts) {
    const engine = getEngine(attemptName);

    try {
      const result = await executeByMode(engine, normalizedMode, filePath, options);
      const elapsed = Date.now() - startedAt;
      const usedFallback = attemptName !== normalizeEngineName(engineName);

      if (usedFallback) {
        console.warn(
          `[process] Fallback activated from ${normalizeEngineName(engineName)} to ${attemptName}`
        );
      }

      return ensureStandardResult(result, {
        engine: attemptName,
        processing_time: elapsed,
        fallback: usedFallback
          ? {
              requested: normalizeEngineName(engineName),
              used: attemptName,
              reason: errors[errors.length - 1] || 'upstream engine failed',
            }
          : null,
        attempted_engines: attempts,
        warnings: Array.isArray(result?.metadata?.warnings) ? result.metadata.warnings : [],
      });
    } catch (err) {
      const message = `${attemptName}: ${err.message}`;
      errors.push(message);
      console.warn(`[process] Engine failed (${message})`);
    }
  }

  throw new Error(`All engines failed. Attempts: ${errors.join(' | ')}`);
}

module.exports = {
  processDocument,
  listEngines,
};
