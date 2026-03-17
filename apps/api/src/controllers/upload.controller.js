const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { uploadFile, getPublicUrl } = require('../services/storage.service');
const { saveFileRecord } = require('../services/db.service');

const handleUpload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Optional case scoping: client sends caseId in the form body
    const caseId = req.body?.caseId || null;
    if (!caseId) {
      return res.status(400).json({ error: 'caseId is required — upload files through a case' });
    }

    const results = [];

    for (const file of req.files) {
      // Generate a unique stored name
      const ext = path.extname(file.originalname);
      const storedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

      // Upload buffer to Supabase Storage (files are prefixed by caseId when present)
      const storagePath = caseId
        ? `cases/${caseId}/${storedName}`
        : `uploads/${storedName}`;
      await uploadFile(file.buffer, storedName, file.mimetype, storagePath);

      // Build file record and persist to Supabase DB
      const record = {
        id: `f_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
        name: file.originalname,
        storedName,
        mime: file.mimetype,
        size: file.size,
        url: getPublicUrl(storedName, storagePath),
        status: 'uploaded',
        extractStatus: 'pending',
        caseId,
      };

      const saved = await saveFileRecord(record);
      results.push(saved);
    }

    return res.status(200).json({ files: results });
  } catch (err) {
    console.error('Upload error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { handleUpload };
