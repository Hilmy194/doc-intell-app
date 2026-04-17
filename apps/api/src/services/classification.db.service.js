const supabase = require('./supabase');

const TABLE = 'document_classifications';

async function getLatestClassificationByFile(fileId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('file_id', fileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Classification fetch failed: ${error.message}`);
  return data ? toClient(data) : null;
}

async function saveClassification(row) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      case_id: row.caseId,
      file_id: row.fileId,
      doc_type: row.docType,
      confidence: row.confidence,
      reasoning: row.reasoning,
      classifier: row.classifier,
      metadata: row.metadata || {},
    })
    .select('*')
    .single();

  if (error) throw new Error(`Classification insert failed: ${error.message}`);
  return toClient(data);
}

function toClient(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    fileId: row.file_id,
    docType: row.doc_type,
    confidence: row.confidence,
    reasoning: row.reasoning,
    classifier: row.classifier,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

module.exports = {
  getLatestClassificationByFile,
  saveClassification,
};
