const { listChunksByCase } = require('../services/chunks.db.service');
const { getCaseRecord } = require('../services/cases.db.service');
const {
  saveEntities, listEntitiesByCase, deleteEntitiesByCase,
  saveRelations, listRelationsByCase, deleteRelationsByCase,
} = require('../services/entities.db.service');
const {
  extractFullFromText,
  buildRelationsFromChunkEntities,
  resolveNamedRelations,
  getExtractorMode,
} = require('../services/entity.service');

// POST /api/entities/extract  { caseId }
const handleExtractEntities = async (req, res) => {
  const { caseId } = req.body;
  if (!caseId) return res.status(400).json({ error: 'caseId is required' });

  const mode = getExtractorMode();

  try {
    await deleteRelationsByCase(caseId);
    await deleteEntitiesByCase(caseId);

    const chunks = await listChunksByCase(caseId);
    if (chunks.length === 0) {
      return res.status(400).json({ error: 'No chunks found. Save chunks first.' });
    }

    // Load user-defined ontology rules for this case
    const caseRecord = await getCaseRecord(caseId);
    const ontologyRules = caseRecord?.ontologyRules || [];
    if (ontologyRules.length > 0) {
      console.log(`[entities] Using ${ontologyRules.length} ontology rules for case ${caseId}`);
    }

    let totalEntities = 0;
    let totalRelations = 0;
    const allSavedEntities = [];
    const allNamedRelations = [];
    // Track which saved entities belong to which chunk (for co-occurrence fallback)
    const chunkEntityMap = new Map();
    let skippedChunks = 0;

    // Snapshot chunk IDs at start to detect concurrent modifications
    const chunkIdSet = new Set(chunks.map((c) => c.id));
    console.log(`[entities] Starting extraction for ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const result = await extractFullFromText(chunk.content, ontologyRules);
        if (result.entities.length === 0) continue;

        const toSave = result.entities.map((e) => ({
          fileId: chunk.fileId,
          caseId: chunk.caseId,
          chunkId: chunk.id,
          entityType: e.entityType,
          entityValue: e.entityValue,
          confidence: e.confidence,
          source: mode === 'heuristic' ? 'heuristic' : 'openai',
        }));

        const saved = await saveEntities(toSave);
        totalEntities += saved.length;
        allSavedEntities.push(...saved);
        chunkEntityMap.set(chunk.id, saved);

        if (mode === 'openai' || mode === 'hybrid') {
          allNamedRelations.push(...result.relations);
        } else {
          const rels = buildRelationsFromChunkEntities(saved);
          if (rels.length > 0) {
            const savedRels = await saveRelations(rels.map((r) => ({ ...r, caseId })));
            totalRelations += savedRels.length;
          }
        }
      } catch (chunkErr) {
        // If chunk was deleted by a concurrent force-rechunk, skip gracefully
        if (chunkErr.message.includes('foreign key constraint')) {
          skippedChunks++;
          if (skippedChunks === 1) {
            console.warn(`[entities] Chunk ${chunk.id} FK error (deleted by concurrent re-chunk?) — skipping`);
          }
          if (skippedChunks > 5) {
            console.error('[entities] Too many FK errors — chunks likely replaced by concurrent pipeline run. Aborting.');
            return res.status(409).json({
              error: 'Chunks were modified by another pipeline run. Please wait and retry.',
            });
          }
          continue;
        }
        throw chunkErr;
      }

      if (i === 0 || (i + 1) % 10 === 0) console.log(`[entities] Processed ${i + 1}/${chunks.length} chunks (${totalEntities} entities so far)`);
    }

    console.log(`[entities] Done: ${totalEntities} entities, ${allNamedRelations.length} LLM relations from ${chunks.length} chunks`);

    // Resolve LLM named relations → entity IDs and save
    if (allNamedRelations.length > 0 && allSavedEntities.length > 0) {
      const resolved = resolveNamedRelations(allNamedRelations, allSavedEntities, caseId);
      if (resolved.length > 0) {
        const savedRels = await saveRelations(resolved);
        totalRelations += savedRels.length;
      }

      // Fallback: if <30% of LLM relations resolved, also add co-occurrence relations
      const resolveRate = resolved.length / allNamedRelations.length;
      if (resolveRate < 0.3) {
        console.warn('[entities] Low resolve rate, adding co-occurrence fallback');
        for (const [, chunkEntities] of chunkEntityMap) {
          const rels = buildRelationsFromChunkEntities(chunkEntities, ontologyRules);
          if (rels.length > 0) {
            const savedRels = await saveRelations(rels.map((r) => ({ ...r, caseId })));
            totalRelations += savedRels.length;
          }
        }
      }
    } else if ((mode === 'openai' || mode === 'hybrid') && allNamedRelations.length === 0) {
      // LLM returned 0 relations — use co-occurrence as fallback
      console.warn('[entities] LLM returned 0 relations, using co-occurrence fallback');
      for (const [, chunkEntities] of chunkEntityMap) {
        const rels = buildRelationsFromChunkEntities(chunkEntities, ontologyRules);
        if (rels.length > 0) {
          const savedRels = await saveRelations(rels.map((r) => ({ ...r, caseId })));
          totalRelations += savedRels.length;
        }
      }
    }

    return res.json({
      success: true,
      extractorMode: mode,
      entityCount: totalEntities,
      relationCount: totalRelations,
      chunksProcessed: chunks.length,
      ontologyRulesUsed: ontologyRules.length,
    });
  } catch (err) {
    console.error('Entity extraction error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/entities/:caseId
const handleListEntities = async (req, res) => {
  const { caseId } = req.params;
  try {
    const entities = await listEntitiesByCase(caseId);
    const relations = await listRelationsByCase(caseId);
    return res.json({ entities, relations, extractorMode: getExtractorMode() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { handleExtractEntities, handleListEntities };
