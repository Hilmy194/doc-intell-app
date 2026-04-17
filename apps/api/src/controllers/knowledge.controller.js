const { listChunksByCase } = require('../services/chunks.db.service');
const { listFileRecordsByCase } = require('../services/db.service');
const { upsertKnowledgeChunks, listKnowledgeByCase, getKnowledgeByChunkId } = require('../services/knowledge.db.service');
const { embedText, rankKnowledge } = require('../services/knowledge.service');

async function indexKnowledge(req, res) {
  const { caseId, force = false } = req.body || {};
  if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });

  try {
    const [chunks, files, existing] = await Promise.all([
      listChunksByCase(caseId),
      listFileRecordsByCase(caseId),
      listKnowledgeByCase(caseId),
    ]);

    if (!chunks.length) {
      return res.status(400).json({ success: false, error: 'No chunks found for this case. Run chunking first.' });
    }

    const fileNameById = new Map(files.map((f) => [f.id, f.name]));
    const existingChunkIds = new Set(existing.map((k) => k.chunkId));

    const targetChunks = force
      ? chunks
      : chunks.filter((c) => !existingChunkIds.has(c.id));

    const rows = [];
    for (const c of targetChunks) {
      const embedding = await embedText(c.content || '');
      rows.push({
        caseId: c.caseId,
        fileId: c.fileId,
        chunkId: c.id,
        content: c.content,
        embedding,
        sourceFileName: fileNameById.get(c.fileId) || null,
        pageNumber: c.metadata?.page || null,
        chunkIndex: c.chunkIndex,
        parserTool: c.metadata?.tool || null,
        metadata: c.metadata || {},
      });
    }

    const saved = await upsertKnowledgeChunks(rows);
    return res.json({
      success: true,
      data: {
        caseId,
        indexedCount: saved.length,
        totalChunks: chunks.length,
        skippedCount: chunks.length - targetChunks.length,
        force,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function searchKnowledge(req, res) {
  const { caseId, query, topK = 8, minScore = 0 } = req.body || {};
  if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });
  if (!query || !String(query).trim()) return res.status(400).json({ success: false, error: 'query is required' });

  try {
    const knowledge = await listKnowledgeByCase(caseId);
    if (!knowledge.length) {
      return res.json({ success: true, data: { evidence: [], retrievedContextCount: 0 } });
    }

    const ranked = await rankKnowledge(String(query), knowledge, Number(topK) || 8, Number(minScore) || 0);
    const evidence = ranked.map((r) => ({
      chunkId: r.chunkId,
      caseId: r.caseId,
      fileId: r.fileId,
      fileName: r.sourceFileName,
      page: r.pageNumber,
      chunkIndex: r.chunkIndex,
      content: r.content,
      score: Number(r.score.toFixed(6)),
      semanticScore: Number(r.semanticScore.toFixed(6)),
      keywordScore: Number(r.keywordScore.toFixed(6)),
      metadata: r.metadata || {},
    }));

    return res.json({
      success: true,
      data: {
        evidence,
        retrievedContextCount: evidence.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function inspectEvidence(req, res) {
  const { chunkId } = req.params;
  if (!chunkId) return res.status(400).json({ success: false, error: 'chunkId is required' });

  try {
    const row = await getKnowledgeByChunkId(chunkId);
    if (!row) return res.status(404).json({ success: false, error: 'Evidence not found' });
    return res.json({ success: true, data: { evidence: row } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  indexKnowledge,
  searchKnowledge,
  inspectEvidence,
};
