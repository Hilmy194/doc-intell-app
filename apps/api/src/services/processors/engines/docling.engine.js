const BaseParser = require('../base.parser');
const doclingExtractor = require('../../extractors/docling.extractor');
const { ensureStandardResult, chunkText } = require('../helpers');

class DoclingEngine extends BaseParser {
  constructor() {
    super('docling');
  }

  async parse(filePath, ctx = {}) {
    const startedAt = Date.now();
    try {
      const extracted = await doclingExtractor.extract(filePath, ctx.mime, ctx.options || {});
      return ensureStandardResult({
        text: extracted?.json?.text || extracted?.markdown || '',
        markdown: extracted?.markdown || '',
        json: extracted?.json || {},
        chunks: Array.isArray(extracted?.chunks)
          ? extracted.chunks
          : chunkText(extracted?.json?.text || extracted?.markdown || '', ctx.options || {}),
        metadata: {
          engine: this.name,
          processing_time: Date.now() - startedAt,
          fallback: null,
          warnings: [],
        },
      });
    } catch (err) {
      return ensureStandardResult({
        text: '',
        markdown: '',
        json: {
          source: filePath,
          error: err.message,
          stub: true,
        },
        chunks: [],
        metadata: {
          engine: this.name,
          processing_time: Date.now() - startedAt,
          fallback: null,
          warnings: [
            `Docling unavailable or failed; returned safe stub. Details: ${err.message}`,
          ],
        },
      });
    }
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
      chunks: chunkText(parsed.text || parsed.markdown || '', ctx.options || {}),
    });
  }
}

module.exports = new DoclingEngine();
