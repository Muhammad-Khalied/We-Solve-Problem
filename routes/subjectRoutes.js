const router = require('express').Router();
const auth = require('../middleware/auth');
const { getSubjects, getSubject, getSubjectSkills } = require('../controllers/subjectController');

router.get('/', auth, getSubjects);
router.get('/:id', auth, getSubject);
router.get('/:id/skills', auth, getSubjectSkills);

module.exports = router;
