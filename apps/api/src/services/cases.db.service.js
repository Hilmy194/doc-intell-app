// Cases CRUD via Supabase PostgreSQL
const supabase = require('./supabase');

const TABLE = 'cases';

/**
 * Insert a new case record.
 */
async function saveCaseRecord(record) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id: record.id,
      name: record.name,
      description: record.description || null,
      user_id: record.userId || null,
    })
    .select()
    .single();

  if (error) throw new Error(`DB insert case failed: ${error.message}`);
  return toClientFormat(data);
}

/**
 * Fetch all cases, ordered by newest first.
 */
async function listCaseRecords() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`DB list cases failed: ${error.message}`);
  return (data || []).map(toClientFormat);
}

/**
 * Get a single case by its id.
 */
async function getCaseRecord(caseId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', caseId)
    .single();

  if (error) return null;
  return toClientFormat(data);
}

/**
 * Update case fields (name, description).
 */
async function updateCaseRecord(caseId, updates) {
  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.description !== undefined) dbUpdates.description = updates.description;

  const { error } = await supabase
    .from(TABLE)
    .update(dbUpdates)
    .eq('id', caseId);

  if (error) throw new Error(`DB update case failed: ${error.message}`);
}

/**
 * Delete a case record by id.
 */
async function deleteCaseRecord(caseId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', caseId);

  if (error) throw new Error(`DB delete case failed: ${error.message}`);
}

function toClientFormat(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    userId: row.user_id,
    createdAt: row.created_at,
  };
}

module.exports = {
  saveCaseRecord,
  listCaseRecords,
  getCaseRecord,
  updateCaseRecord,
  deleteCaseRecord,
};
