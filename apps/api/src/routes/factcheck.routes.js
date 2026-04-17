const router = require('express').Router();
const auth = require('../middlewares/auth.middleware');
const { runFactCheck } = require('../controllers/factcheck.controller');

router.use(auth);
router.post('/claim', runFactCheck);

module.exports = router;
