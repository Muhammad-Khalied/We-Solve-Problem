const router = require('express').Router();
const auth = require('../middleware/auth');
const { getTask, runCode, submitTask, getStudentAIFeedback } = require('../controllers/taskController');

router.get('/:id', auth, getTask);
router.post('/:id/run', auth, runCode);
router.post('/:id/submit', auth, submitTask);
router.post('/:id/feedback', auth, getStudentAIFeedback);

module.exports = router;
