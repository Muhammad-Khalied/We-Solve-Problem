const router = require('express').Router();
const auth = require('../middleware/auth');
const { sendChatMessage, getChatHistory, requestHint } = require('../controllers/chatController');

router.post('/:taskId', auth, sendChatMessage);
router.get('/:taskId/history', auth, getChatHistory);
router.post('/:taskId/hint', auth, requestHint);

module.exports = router;
