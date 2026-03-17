const supabase = require('./supabase');

const TABLE = 'files';

async function saveFileRecord(record) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      id: record.id,
      name: record.name,
      stored_name: record.storedName,
      mime: record.mime,
      size: record.size,
      url: record.url,
      status: record.status || 'uploaded',
      extract_status: record.extractStatus || 'pending',
      case_id: record.caseId || null,
    })
    .select()
    .single();

  if (error) throw new Error(`DB insert failed: ${error.message}`);
  return toClientFormat(data);
}

async function listFileRecords() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(`DB list failed: ${error.message}`);
  return (data || []).map(toClientFormat);
}

async function listFileRecordsByCase(caseId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('case_id', caseId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(`DB list by case failed: ${error.message}`);
  return (data || []).map(toClientFormat);
}

async function getFileRecord(storedName) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('stored_name', storedName)
    .single();

  if (error) return null;
  return toClientFormat(data);
}

async function updateFileRecord(storedName, updates) {
  const dbUpdates = {};
  if (updates.status) dbUpdates.status = updates.status;
  if (updates.extractStatus) dbUpdates.extract_status = updates.extractStatus;

  const { error } = await supabase
    .from(TABLE)
    .update(dbUpdates)
    .eq('stored_name', storedName);

  if (error) throw new Error(`DB update failed: ${error.message}`);
}

async function deleteFileRecord(storedName) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('stored_name', storedName);

  if (error) throw new Error(`DB delete failed: ${error.message}`);
}

function toClientFormat(row) {
  return {
    id: row.id,
    name: row.name,
    storedName: row.stored_name,
    mime: row.mime,
    size: row.size,
    url: row.url,
    uploadedAt: row.uploaded_at,
    status: row.status,
    extractStatus: row.extract_status,
    caseId: row.case_id || null,
  };
}

module.exports = {
  saveFileRecord,
  listFileRecords,
  listFileRecordsByCase,
  getFileRecord,
  updateFileRecord,
  deleteFileRecord,
};
