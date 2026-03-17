const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const {
  listCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  listCaseFiles,
  getOntology,
  updateOntology,
} = require('../controllers/cases.controller');

const router = express.Router();

router.get('/', listCases);
router.post('/', authMiddleware, createCase);
router.get('/:caseId', getCase);
router.patch('/:caseId', authMiddleware, updateCase);
router.delete('/:caseId', authMiddleware, deleteCase);
router.get('/:caseId/files', listCaseFiles);
router.get('/:caseId/ontology', getOntology);
router.put('/:caseId/ontology', authMiddleware, updateOntology);

module.exports = router;
