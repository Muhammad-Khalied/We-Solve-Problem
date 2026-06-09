const router = require('express').Router();
const auth = require('../middleware/auth');
const { getSkills, getSkill, getSkillTasks } = require('../controllers/skillController');

router.get('/', auth, getSkills);
router.get('/:id', auth, getSkill);
router.get('/:id/tasks', auth, getSkillTasks);

module.exports = router;
