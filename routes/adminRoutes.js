const router = require('express').Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getAllStudents, getStudentDetails, getAnalytics,
  createSkill, updateSkill, deleteSkill,
  createTask, updateTask, deleteTask, getAllTasks
} = require('../controllers/adminController');
const {
  contentAIChat, acceptGeneratedContent, acceptGeneratedTask
} = require('../controllers/contentAIController');

// All admin routes require auth + admin role
router.use(auth, admin);

router.get('/students', getAllStudents);
router.get('/students/:id', getStudentDetails);
router.get('/analytics', getAnalytics);

router.post('/skills', createSkill);
router.put('/skills/:id', updateSkill);
router.delete('/skills/:id', deleteSkill);

router.get('/tasks', getAllTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

// Content AI Generator
router.post('/content-ai/chat', contentAIChat);
router.post('/content-ai/accept', acceptGeneratedContent);
router.post('/content-ai/accept-task', acceptGeneratedTask);

module.exports = router;
