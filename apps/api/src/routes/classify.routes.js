const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const { runClassification } = require('../controllers/classify.controller');

router.use(auth);
router.post('/run', runClassification);

module.exports = router;
