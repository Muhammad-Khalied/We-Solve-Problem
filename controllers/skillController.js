const Skill = require('../models/Skill');
const Task = require('../models/Task');
const Submission = require('../models/Submission');

// @desc    Get all skills
// @route   GET /api/skills
exports.getSkills = async (req, res, next) => {
  try {
    const skills = await Skill.find().populate('subject', 'name color').sort('order');
    res.json(skills);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single skill with tasks
// @route   GET /api/skills/:id
exports.getSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findById(req.params.id).populate('subject', 'name color');
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    res.json(skill);
  } catch (error) {
    next(error);
  }
};

// @desc    Get tasks for a skill with user completion status
// @route   GET /api/skills/:id/tasks
exports.getSkillTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find({ skill: req.params.id }).sort('order');

    // Get user's submissions for these tasks
    const taskIds = tasks.map(t => t._id);
    const submissions = await Submission.find({
      user: req.user._id,
      task: { $in: taskIds }
    }).sort('-score');

    // Create a map of best submission per task
    const bestSubmissions = {};
    submissions.forEach(sub => {
      const taskId = sub.task.toString();
      if (!bestSubmissions[taskId] || sub.score > bestSubmissions[taskId].score) {
        bestSubmissions[taskId] = sub;
      }
    });

    const tasksWithStatus = tasks.map(task => ({
      _id: task._id,
      title: task.title,
      type: task.type,
      difficulty: task.difficulty,
      points: task.points,
      language: task.language,
      order: task.order,
      status: bestSubmissions[task._id.toString()]
        ? bestSubmissions[task._id.toString()].status
        : 'not-attempted',
      bestScore: bestSubmissions[task._id.toString()]?.score || 0,
      attempts: bestSubmissions[task._id.toString()]?.attempts || 0
    }));

    res.json(tasksWithStatus);
  } catch (error) {
    next(error);
  }
};
