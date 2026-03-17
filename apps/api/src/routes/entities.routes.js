const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const { handleExtractEntities, handleListEntities } = require('../controllers/entities.controller');

router.use(auth);

router.post('/extract', handleExtractEntities);
router.get('/:caseId', handleListEntities);

module.exports = router;
