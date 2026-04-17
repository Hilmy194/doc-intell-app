const supabase = require('./supabase');

const KNOWLEDGE_TABLE = 'knowledge_chunks';
const FACT_CHECK_TABLE = 'fact_check_runs';

async function upsertKnowledgeChunks(rows) {
  if (!rows.length) return [];
  const payload = rows.map((r) => ({
    case_id: r.caseId,
    file_id: r.fileId,
    chunk_id: r.chunkId,
    content: r.content,
    embedding: r.embedding,
    source_file_name: r.sourceFileName || null,
    page_number: r.pageNumber ?? null,
    chunk_index: r.chunkIndex ?? null,
    parser_tool: r.parserTool || null,
    metadata: r.metadata || {},
  }));

  const { data, error } = await supabase
    .from(KNOWLEDGE_TABLE)
    .upsert(payload, { onConflict: 'chunk_id' })
    .select('*');

  if (error) throw new Error(`Knowledge upsert failed: ${error.message}`);
  return (data || []).map(toKnowledgeClient);
}

async function listKnowledgeByCase(caseId) {
  const { data, error } = await supabase
    .from(KNOWLEDGE_TABLE)
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Knowledge list failed: ${error.message}`);
  return (data || []).map(toKnowledgeClient);
}

async function getKnowledgeByChunkId(chunkId) {
  const { data, error } = await supabase
    .from(KNOWLEDGE_TABLE)
    .select('*')
    .eq('chunk_id', chunkId)
    .maybeSingle();

  if (error) throw new Error(`Knowledge evidence fetch failed: ${error.message}`);
  return data ? toKnowledgeClient(data) : null;
}

async function saveFactCheckRun(row) {
  const { data, error } = await supabase
    .from(FACT_CHECK_TABLE)
    .insert({
      case_id: row.caseId,
      claim: row.claim,
      verdict: row.verdict,
      confidence: row.confidence,
      summary_reasoning: row.summaryReasoning,
      limitations: row.limitations || null,
      retrieved_context_count: row.retrievedContextCount || 0,
      evidence: row.evidence || [],
      metadata: row.metadata || {},
    })
    .select('*')
    .single();

  if (error) throw new Error(`Fact-check run insert failed: ${error.message}`);
  return {
    id: data.id,
    caseId: data.case_id,
    claim: data.claim,
    verdict: data.verdict,
    confidence: data.confidence,
    summaryReasoning: data.summary_reasoning,
    limitations: data.limitations,
    retrievedContextCount: data.retrieved_context_count,
    evidence: data.evidence || [],
    metadata: data.metadata || {},
    createdAt: data.created_at,
  };
}

function toKnowledgeClient(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    fileId: row.file_id,
    chunkId: row.chunk_id,
    content: row.content,
    embedding: row.embedding,
    sourceFileName: row.source_file_name,
    pageNumber: row.page_number,
    chunkIndex: row.chunk_index,
    parserTool: row.parser_tool,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

module.exports = {
  upsertKnowledgeChunks,
  listKnowledgeByCase,
  getKnowledgeByChunkId,
  saveFactCheckRun,
};
