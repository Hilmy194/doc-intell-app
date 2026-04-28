const fs = require('fs');
const BaseParser = require('../base.parser');
const { ensureStandardResult, chunkText, resolveFileInfo } = require('../helpers');

class OpenDataLoaderEngine extends BaseParser {
  constructor() {
    super('opendataloader_pdf');
  }

  async parse(filePath, ctx = {}) {
    const startedAt = Date.now();
    const info = resolveFileInfo(filePath, ctx.mime);

    if (info.ext !== 'pdf' && info.mime !== 'application/pdf') {
      throw new Error('OpenDataLoader PDF only supports PDF input');
    }

    let size = 0;
    try {
      size = fs.statSync(filePath).size;
    } catch {}

    const text = '';
    const warning =
      'OpenDataLoader PDF engine is running in safe stub mode; install a concrete parser implementation to enable full text extraction.';

    return ensureStandardResult({
      text,
      markdown: `# ${info.fileName}\n\n${warning}`,
      json: {
        source: info.fileName,
        parser: 'opendataloader_pdf',
        stub: true,
        file_size_bytes: size,
      },
      chunks: chunkText(text, ctx.options || {}),
      metadata: {
        engine: this.name,
        processing_time: Date.now() - startedAt,
        fallback: null,
        warnings: [warning],
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

module.exports = new OpenDataLoaderEngine();
