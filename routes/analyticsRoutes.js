const router = require('express').Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  triggerAnalysis,
  getChatAnalysis,
  getSkillEvaluation,
  getFeedback,
  getStudentOverview,
  getStudentTaskEvents
} = require('../controllers/analyticsController');

// All analytics routes require auth + admin role
router.use(auth, admin);

// Trigger full AI analysis for a student+task
router.post('/analyze/:studentId/:taskId', triggerAnalysis);

// Get cached analysis results
router.get('/chat/:studentId/:taskId', getChatAnalysis);
router.get('/skills/:studentId/:taskId', getSkillEvaluation);
router.get('/feedback/:studentId/:taskId', getFeedback);

// Student overview (all tasks)
router.get('/student/:studentId/overview', getStudentOverview);

// Event timeline for a student+task
router.get('/student/:studentId/tasks/:taskId/events', getStudentTaskEvents);

module.exports = router;
