const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const {
  listCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  listCaseFiles,
} = require('../controllers/cases.controller');

const router = express.Router();

router.get('/', listCases);
router.post('/', authMiddleware, createCase);
router.get('/:caseId', getCase);
router.patch('/:caseId', authMiddleware, updateCase);
router.delete('/:caseId', authMiddleware, deleteCase);
router.get('/:caseId/files', listCaseFiles);

module.exports = router;
