const supabase = require('./supabase');

const ENTITIES_TABLE = 'extracted_entities';
const RELATIONS_TABLE = 'entity_relations';

// ── Entities ─────────────────────────────────────────────────────────────────

async function saveEntities(entities) {
  if (!entities.length) return [];
  const rows = entities.map((e) => ({
    file_id: e.fileId,
    case_id: e.caseId,
    chunk_id: e.chunkId || null,
    entity_type: e.entityType,
    entity_value: e.entityValue,
    confidence: e.confidence ?? 1.0,
    source: e.source || 'heuristic',
  }));

  const { data, error } = await supabase
    .from(ENTITIES_TABLE)
    .insert(rows)
    .select();

  if (error) throw new Error(`Entity insert failed: ${error.message}`);
  return (data || []).map(entityToClient);
}

async function listEntitiesByCase(caseId) {
  const { data, error } = await supabase
    .from(ENTITIES_TABLE)
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Entity list failed: ${error.message}`);
  return (data || []).map(entityToClient);
}

async function listEntitiesByFile(fileId) {
  const { data, error } = await supabase
    .from(ENTITIES_TABLE)
    .select('*')
    .eq('file_id', fileId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Entity list by file failed: ${error.message}`);
  return (data || []).map(entityToClient);
}

async function deleteEntitiesByCase(caseId) {
  const { error } = await supabase
    .from(ENTITIES_TABLE)
    .delete()
    .eq('case_id', caseId);

  if (error) throw new Error(`Entity delete failed: ${error.message}`);
}

async function deleteEntitiesByFile(fileId) {
  const { error } = await supabase
    .from(ENTITIES_TABLE)
    .delete()
    .eq('file_id', fileId);

  if (error) throw new Error(`Entity delete by file failed: ${error.message}`);
}

// ── Relations ────────────────────────────────────────────────────────────────

async function saveRelations(relations) {
  if (!relations.length) return [];
  const rows = relations.map((r) => ({
    case_id: r.caseId,
    source_entity: r.sourceEntity,
    target_entity: r.targetEntity,
    relation_type: r.relationType,
    confidence: r.confidence ?? 1.0,
  }));

  const { data, error } = await supabase
    .from(RELATIONS_TABLE)
    .insert(rows)
    .select();

  if (error) throw new Error(`Relation insert failed: ${error.message}`);
  return (data || []).map(relationToClient);
}

async function listRelationsByCase(caseId) {
  const { data, error } = await supabase
    .from(RELATIONS_TABLE)
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Relation list failed: ${error.message}`);
  return (data || []).map(relationToClient);
}

async function deleteRelationsByCase(caseId) {
  const { error } = await supabase
    .from(RELATIONS_TABLE)
    .delete()
    .eq('case_id', caseId);

  if (error) throw new Error(`Relation delete failed: ${error.message}`);
}

// ── Formatters ───────────────────────────────────────────────────────────────

function entityToClient(row) {
  return {
    id: row.id,
    fileId: row.file_id,
    caseId: row.case_id,
    chunkId: row.chunk_id,
    entityType: row.entity_type,
    entityValue: row.entity_value,
    confidence: row.confidence,
    source: row.source,
    createdAt: row.created_at,
  };
}

function relationToClient(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    sourceEntity: row.source_entity,
    targetEntity: row.target_entity,
    relationType: row.relation_type,
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

module.exports = {
  saveEntities,
  listEntitiesByCase,
  listEntitiesByFile,
  deleteEntitiesByCase,
  deleteEntitiesByFile,
  saveRelations,
  listRelationsByCase,
  deleteRelationsByCase,
};
