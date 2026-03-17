const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const { handleBuildGraph, handleGetGraph } = require('../controllers/graph.controller');

router.use(auth);

router.post('/build', handleBuildGraph);
router.get('/:caseId', handleGetGraph);

module.exports = router;
