const router = require('express').Router();
const auth = require('../middleware/auth');
const { getMySubmissions, getMyStats, getLeaderboard } = require('../controllers/submissionController');

router.get('/my', auth, getMySubmissions);
router.get('/stats', auth, getMyStats);
router.get('/leaderboard', auth, getLeaderboard);

module.exports = router;
