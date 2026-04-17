const { listKnowledgeByCase, saveFactCheckRun } = require('../services/knowledge.db.service');
const { rankKnowledge } = require('../services/knowledge.service');
const { evaluateClaimGrounded } = require('../services/factcheck.service');

async function runFactCheck(req, res) {
  const { caseId, claim, topK = 8, minScore = 0.1 } = req.body || {};
  if (!caseId) return res.status(400).json({ success: false, error: 'caseId is required' });
  if (!claim || !String(claim).trim()) return res.status(400).json({ success: false, error: 'claim is required' });

  try {
    const knowledge = await listKnowledgeByCase(caseId);
    const ranked = await rankKnowledge(String(claim), knowledge, Number(topK) || 8, Number(minScore) || 0.1);

    const evidence = ranked.map((r) => ({
      chunkId: r.chunkId,
      caseId: r.caseId,
      fileId: r.fileId,
      fileName: r.sourceFileName,
      page: r.pageNumber,
      chunkIndex: r.chunkIndex,
      content: r.content,
      score: Number(r.score.toFixed(6)),
      metadata: r.metadata || {},
    }));

    const judged = await evaluateClaimGrounded({ claim: String(claim), evidence });
    const selectedEvidence = (judged.evidenceIndices || [])
      .map((idx) => evidence[idx])
      .filter(Boolean);

    const payload = {
      claim: String(claim),
      verdict: judged.verdict,
      confidence: judged.confidence,
      summary_reasoning: judged.summaryReasoning,
      evidence: selectedEvidence,
      limitations: judged.limitations,
      retrieved_context_count: evidence.length,
    };

    const saved = await saveFactCheckRun({
      caseId,
      claim: payload.claim,
      verdict: payload.verdict,
      confidence: payload.confidence,
      summaryReasoning: payload.summary_reasoning,
      limitations: payload.limitations,
      retrievedContextCount: payload.retrieved_context_count,
      evidence: payload.evidence,
      metadata: {
        topK: Number(topK) || 8,
        minScore: Number(minScore) || 0.1,
      },
    });

    return res.json({
      success: true,
      data: {
        ...payload,
        runId: saved.id,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  runFactCheck,
};
