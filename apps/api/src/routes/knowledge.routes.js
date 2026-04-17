const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const { indexKnowledge, searchKnowledge, inspectEvidence } = require('../controllers/knowledge.controller');

router.use(auth);
router.post('/index', indexKnowledge);
router.post('/search', searchKnowledge);
router.get('/evidence/:chunkId', inspectEvidence);

module.exports = router;
