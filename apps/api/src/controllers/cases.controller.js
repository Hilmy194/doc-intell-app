// Cases controller — CRUD for case records
const { v4: uuidv4 } = require('uuid');
const {
  saveCaseRecord,
  listCaseRecords,
  getCaseRecord,
  updateCaseRecord,
  deleteCaseRecord,
} = require('../services/cases.db.service');
const { listFileRecordsByCase, deleteFileRecord } = require('../services/db.service');
const { deleteFile: deleteFromStorage } = require('../services/storage.service');

// GET /api/cases — list all cases with file counts
const listCases = async (_req, res) => {
  try {
    const cases = await listCaseRecords();
    return res.json({ cases });
  } catch (err) {
    console.error('listCases error:', err.message);
    return res.status(500).json({ error: 'Failed to list cases' });
  }
};

// GET /api/cases/:caseId — get a single case
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

// POST /api/cases — create a new case
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

// PATCH /api/cases/:caseId — update case name/description
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

// DELETE /api/cases/:caseId — delete case and all its files
const deleteCase = async (req, res) => {
  const { caseId } = req.params;
  try {
    const existing = await getCaseRecord(caseId);
    if (!existing) return res.status(404).json({ error: 'Case not found' });

    // Delete all files belonging to this case
    const files = await listFileRecordsByCase(caseId);
    for (const file of files) {
      try {
        await deleteFromStorage(file.storedName);
      } catch (_) { /* best-effort storage cleanup */ }
      await deleteFileRecord(file.storedName);
    }

    await deleteCaseRecord(caseId);
    return res.json({ success: true, caseId });
  } catch (err) {
    console.error('deleteCase error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/cases/:caseId/files — list files for a case
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

module.exports = { listCases, getCase, createCase, updateCase, deleteCase, listCaseFiles };
