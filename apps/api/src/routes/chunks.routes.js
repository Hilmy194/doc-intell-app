const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const { handleSaveChunks, handleListChunks, handleDeleteChunks } = require('../controllers/chunks.controller');

router.use(auth);

router.post('/save', handleSaveChunks);
router.get('/:storedName', handleListChunks);
router.delete('/:storedName', handleDeleteChunks);

module.exports = router;
