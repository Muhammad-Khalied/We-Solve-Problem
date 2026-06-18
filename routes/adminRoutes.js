const router = require('express').Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getAllStudents, getStudentDetails, getAnalytics,
  createSubject, updateSubject, deleteSubject,
  createSkill, updateSkill, deleteSkill, bulkUpdateSkills,
  createTask, updateTask, deleteTask, getAllTasks
} = require('../controllers/adminController');
const {
  contentAIChat, acceptGeneratedContent, acceptGeneratedTask, uploadMaterialFile
} = require('../controllers/contentAIController');

// Multer config for file uploads (memory storage)
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// All admin routes require auth + admin role
router.use(auth, admin);

router.get('/students', getAllStudents);
router.get('/students/:id', getStudentDetails);
router.get('/analytics', getAnalytics);

// Subjects, Skills & Tasks Content Management
router.post('/subjects', createSubject);
router.put('/subjects/:id', updateSubject);
router.delete('/subjects/:id', deleteSubject);

router.post('/skills', createSkill);
router.put('/skills/bulk-update', bulkUpdateSkills);
router.put('/skills/:id', updateSkill);
router.delete('/skills/:id', deleteSkill);

router.get('/tasks', getAllTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

// Content AI Generator
router.post('/content-ai/chat', contentAIChat);
router.post('/content-ai/upload', upload.single('file'), uploadMaterialFile);
router.post('/content-ai/accept', acceptGeneratedContent);
router.post('/content-ai/accept-task', acceptGeneratedTask);

module.exports = router;
