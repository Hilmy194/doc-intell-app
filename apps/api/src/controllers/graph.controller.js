const { listEntitiesByCase, listRelationsByCase, saveRelations } = require('../services/entities.db.service');
const { getCaseRecord } = require('../services/cases.db.service');
const { buildRelationsFromChunkEntities } = require('../services/entity.service');

const ENTITY_COLORS = {
  PERSON: '#f97316',
  ORGANIZATION: '#3b82f6',
  DATE: '#22c55e',
  MONEY: '#eab308',
  EMAIL: '#ec4899',
  PHONE: '#8b5cf6',
  ID: '#06b6d4',
  LOCATION: '#ef4444',
  DEFAULT: '#6b7280',
};

// POST /api/graph/build  { caseId }
// Applies ontology rules as co-occurrence pass on already-saved entities.
// Useful when user updates ontology AFTER extraction — adds missing links without re-running AI.
const handleBuildGraph = async (req, res) => {
  const { caseId } = req.body;
  if (!caseId) return res.status(400).json({ error: 'caseId is required' });

  try {
    const caseRecord = await getCaseRecord(caseId);
    const ontologyRules = caseRecord?.ontologyRules || [];

    if (ontologyRules.length === 0) {
      return res.json({
        success: true,
        message: 'No ontology rules defined — add rules in the Ontology panel first.',
        relationsCreated: 0,
      });
    }

    const entities = await listEntitiesByCase(caseId);
    if (entities.length === 0) {
      return res.status(400).json({ error: 'No entities found. Run entity extraction first.' });
    }

    // Get existing relations to avoid duplicates
    const existingRels = await listRelationsByCase(caseId);
    const existingPairs = new Set(
      existingRels.map((r) => `${r.sourceEntity}::${r.relationType}::${r.targetEntity}`)
    );

    // Group entities by chunk (or file if no chunk)
    const chunkMap = new Map();
    for (const e of entities) {
      const key = e.chunkId || `file_${e.fileId}`;
      if (!chunkMap.has(key)) chunkMap.set(key, []);
      chunkMap.get(key).push(e);
    }

    // Apply co-occurrence using the ontology rules
    let totalCreated = 0;
    for (const [, chunkEntities] of chunkMap) {
      const newRels = buildRelationsFromChunkEntities(chunkEntities, ontologyRules)
        .map((r) => ({ ...r, caseId }))
        .filter((r) => !existingPairs.has(`${r.sourceEntity}::${r.relationType}::${r.targetEntity}`));

      if (newRels.length > 0) {
        const saved = await saveRelations(newRels);
        totalCreated += saved.length;
      }
    }

    console.log(`[graph] Co-occurrence pass: ${totalCreated} new relations created for case ${caseId}`);

    return res.json({
      success: true,
      relationsCreated: totalCreated,
      ontologyRulesApplied: ontologyRules.length,
    });
  } catch (err) {
    console.error('Graph build error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/graph/:caseId — returns nodes + links for react-force-graph
const handleGetGraph = async (req, res) => {
  const { caseId } = req.params;

  try {
    const entities = await listEntitiesByCase(caseId);
    const relations = await listRelationsByCase(caseId);

    // Deduplicate entities by value+type (merge duplicates across files)
    const nodeMap = new Map();
    const idToNode = new Map();

    for (const e of entities) {
      const key = `${e.entityType}::${e.entityValue.toLowerCase()}`;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          id: key,
          name: e.entityValue,
          type: e.entityType,
          color: ENTITY_COLORS[e.entityType] || ENTITY_COLORS.DEFAULT,
          sourceIds: [e.id],
        });
      } else {
        nodeMap.get(key).sourceIds.push(e.id);
      }
      idToNode.set(e.id, key);
    }

    const nodes = Array.from(nodeMap.values());

    // Map relations to deduplicated node keys
    const linkSet = new Set();
    const links = [];
    for (const r of relations) {
      const src = idToNode.get(r.sourceEntity);
      const tgt = idToNode.get(r.targetEntity);
      if (!src || !tgt || src === tgt) continue;
      const linkKey = `${src}>${r.relationType}>${tgt}`;
      if (linkSet.has(linkKey)) continue;
      linkSet.add(linkKey);
      links.push({
        source: src,
        target: tgt,
        type: r.relationType,
        confidence: r.confidence,
      });
    }

    return res.json({
      nodes,
      links,
      stats: {
        totalEntities: entities.length,
        uniqueNodes: nodes.length,
        totalRelations: relations.length,
        uniqueLinks: links.length,
      },
    });
  } catch (err) {
    console.error('Graph get error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { handleBuildGraph, handleGetGraph };
