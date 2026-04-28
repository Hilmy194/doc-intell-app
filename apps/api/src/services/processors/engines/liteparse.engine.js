const BaseParser = require('../base.parser');
const { ensureStandardResult, chunkText, readUtf8IfTextLike, resolveFileInfo } = require('../helpers');

class LiteparseEngine extends BaseParser {
  constructor() {
    super('liteparse');
  }

  async parse(filePath, ctx = {}) {
    const startedAt = Date.now();
    const text = readUtf8IfTextLike(filePath, ctx.mime);

    if (text === null) {
      const info = resolveFileInfo(filePath, ctx.mime);
      throw new Error(
        `Liteparse local mode currently supports text-like inputs only; received .${info.ext || 'unknown'} (${info.mime || 'unknown mime'})`
      );
    }

    const markdown = text;
    return ensureStandardResult({
      text,
      markdown,
      json: {
        source: resolveFileInfo(filePath, ctx.mime).fileName,
        parser: 'liteparse-local',
      },
      chunks: chunkText(text, ctx.options || {}),
      metadata: {
        engine: this.name,
        processing_time: Date.now() - startedAt,
        fallback: null,
        warnings: [],
      },
    });
  }

  async extract(filePath, schema = {}, ctx = {}) {
    const parsed = await this.parse(filePath, ctx);
    return ensureStandardResult({
      ...parsed,
      json: {
        ...parsed.json,
        schema,
      },
    });
  }

  async split(filePath, ctx = {}) {
    const parsed = await this.parse(filePath, ctx);
    return ensureStandardResult({
      ...parsed,
      chunks: chunkText(parsed.text, ctx.options || {}),
    });
  }
}

module.exports = new LiteparseEngine();
