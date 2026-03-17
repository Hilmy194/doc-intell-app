const supabase = require('./supabase');

const TABLE = 'file_chunks';

async function saveChunks(fileId, caseId, chunks) {
  const rows = chunks.map((c, i) => ({
    file_id: fileId,
    case_id: caseId,
    chunk_index: c.index ?? i,
    content: c.text,
    token_estimate: c.tokenEstimate || 0,
    metadata: c.isTable ? { isTable: true } : {},
  }));

  // Batch insert to avoid body-size limits on large documents
  const BATCH = 100;
  const allSaved = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from(TABLE)
      .insert(batch)
      .select();

    if (error) throw new Error(`Chunk insert failed (batch ${Math.floor(i / BATCH) + 1}): ${error.message}`);
    allSaved.push(...(data || []).map(toClientFormat));
  }
  return allSaved;
}

async function listChunksByFile(fileId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('file_id', fileId)
    .order('chunk_index', { ascending: true });

  if (error) throw new Error(`Chunk list failed: ${error.message}`);
  return (data || []).map(toClientFormat);
}

async function listChunksByCase(caseId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('case_id', caseId)
    .order('chunk_index', { ascending: true });

  if (error) throw new Error(`Chunk list by case failed: ${error.message}`);
  return (data || []).map(toClientFormat);
}

async function deleteChunksByFile(fileId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('file_id', fileId);

  if (error) throw new Error(`Chunk delete failed: ${error.message}`);
}

function toClientFormat(row) {
  return {
    id: row.id,
    fileId: row.file_id,
    caseId: row.case_id,
    chunkIndex: row.chunk_index,
    content: row.content,
    tokenEstimate: row.token_estimate,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

module.exports = {
  saveChunks,
  listChunksByFile,
  listChunksByCase,
  deleteChunksByFile,
};
