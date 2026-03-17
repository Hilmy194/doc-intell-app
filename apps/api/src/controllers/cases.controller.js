const { v4: uuidv4 } = require('uuid');
const {
  saveCaseRecord,
  listCaseRecords,
  getCaseRecord,
  updateCaseRecord,
  updateOntologyRules,
  deleteCaseRecord,
} = require('../services/cases.db.service');
const { listFileRecordsByCase, deleteFileRecord } = require('../services/db.service');
const { deleteFile: deleteFromStorage } = require('../services/storage.service');

const listCases = async (_req, res) => {
  try {
    const cases = await listCaseRecords();
    return res.json({ cases });
  } catch (err) {
    console.error('listCases error:', err.message);
    return res.status(500).json({ error: 'Failed to list cases' });
  }
};

const getCase = async (req, res) => {
  const { caseId } = req.params;
  try {
    const record = await getCaseRecord(caseId);
    if (!record) return res.status(404).json({ error: 'Case not found' });
    return res.json({ case: record });
  } catch (err) {
    console.error('getCase error:', err.message);
    return res.status(500).json({ error: 'Failed to get case' });
  }
};

const createCase = async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Case name is required' });
  }

  try {
    const record = {
      id: `case_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
      name: name.trim(),
      description: description?.trim() || null,
      userId: req.user?.userId || null,
    };
    const saved = await saveCaseRecord(record);
    return res.status(201).json({ case: saved });
  } catch (err) {
    console.error('createCase error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

const updateCase = async (req, res) => {
  const { caseId } = req.params;
  const { name, description } = req.body;

  try {
    const existing = await getCaseRecord(caseId);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    await updateCaseRecord(caseId, { name, description });
    const updated = await getCaseRecord(caseId);
    return res.json({ case: updated });
  } catch (err) {
    console.error('updateCase error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

const deleteCase = async (req, res) => {
  const { caseId } = req.params;
  try {
    const existing = await getCaseRecord(caseId);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    const files = await listFileRecordsByCase(caseId);
    for (const file of files) {
      try { await deleteFromStorage(file.storedName, file.caseId); } catch (_) {}
      await deleteFileRecord(file.storedName);
    }

    await deleteCaseRecord(caseId);
    return res.json({ success: true, caseId });
  } catch (err) {
    console.error('deleteCase error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

const listCaseFiles = async (req, res) => {
  const { caseId } = req.params;
  try {
    const files = await listFileRecordsByCase(caseId);
    return res.json({ files });
  } catch (err) {
    console.error('listCaseFiles error:', err.message);
    return res.status(500).json({ error: 'Failed to list case files' });
  }
};

const getOntology = async (req, res) => {
  const { caseId } = req.params;
  try {
    const record = await getCaseRecord(caseId);
    if (!record) return res.status(404).json({ error: 'Case not found' });
    return res.json({ ontologyRules: record.ontologyRules || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateOntology = async (req, res) => {
  const { caseId } = req.params;
  const { rules } = req.body;

  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: 'rules must be an array' });
  }

  // Validate each rule has required fields
  for (const r of rules) {
    if (!r.from || !r.to || !r.relation) {
      return res.status(400).json({ error: 'Each rule needs from, to, and relation fields' });
    }
  }

  try {
    const existing = await getCaseRecord(caseId);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    await updateOntologyRules(caseId, rules);
    return res.json({ success: true, rules });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { listCases, getCase, createCase, updateCase, deleteCase, listCaseFiles, getOntology, updateOntology };
