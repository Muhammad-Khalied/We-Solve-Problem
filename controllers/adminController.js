const User = require('../models/User');
const Submission = require('../models/Submission');
const Task = require('../models/Task');
const Skill = require('../models/Skill');
const Subject = require('../models/Subject');
const ChatHistory = require('../models/ChatHistory');

// @desc    Get all students with stats
// @route   GET /api/admin/students
exports.getAllStudents = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student' })
      .select('-password')
      .sort('-totalScore');

    const studentsWithStats = await Promise.all(
      students.map(async (student) => {
        const completed = await Submission.countDocuments({ user: student._id, status: 'passed' });
        const totalAttempts = await Submission.countDocuments({ user: student._id });
        return { ...student.toObject(), tasksCompleted: completed, totalAttempts };
      })
    );

    res.json(studentsWithStats);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single student details
// @route   GET /api/admin/students/:id
exports.getStudentDetails = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const submissions = await Submission.find({ user: student._id })
      .populate('task', 'title type difficulty points')
      .sort('-updatedAt');

    const chatLogs = await ChatHistory.find({ user: student._id })
      .populate('task', 'title')
      .sort('-updatedAt')
      .limit(20);

    res.json({ student, submissions, chatLogs });
  } catch (error) {
    next(error);
  }
};

// @desc    Get platform analytics
// @route   GET /api/admin/analytics
exports.getAnalytics = async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTasks = await Task.countDocuments();
    const totalSubmissions = await Submission.countDocuments();
    const passedSubmissions = await Submission.countDocuments({ status: 'passed' });
    const totalChats = await ChatHistory.countDocuments();

    // Most completed tasks
    const topTasks = await Submission.aggregate([
      { $match: { status: 'passed' } },
      { $group: { _id: '$task', completions: { $sum: 1 } } },
      { $sort: { completions: -1 } },
      { $limit: 10 }
    ]);
    const topTaskIds = topTasks.map(t => t._id);
    const topTaskDocs = await Task.find({ _id: { $in: topTaskIds } }).select('title difficulty type');
    const taskMap = {};
    topTaskDocs.forEach(t => { taskMap[t._id.toString()] = t; });

    // Least completed tasks
    const bottomTasks = await Submission.aggregate([
      { $match: { status: 'passed' } },
      { $group: { _id: '$task', completions: { $sum: 1 } } },
      { $sort: { completions: 1 } },
      { $limit: 10 }
    ]);

    res.json({
      totalStudents,
      totalTasks,
      totalSubmissions,
      passedSubmissions,
      passRate: totalSubmissions > 0 ? Math.round((passedSubmissions / totalSubmissions) * 100) : 0,
      totalChats,
      topTasks: topTasks.map(t => ({
        task: taskMap[t._id.toString()],
        completions: t.completions
      }))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create/Update/Delete skills and tasks (CRUD)
exports.createSkill = async (req, res, next) => {
  try {
    const skill = await Skill.create(req.body);
    res.status(201).json(skill);
  } catch (error) { next(error); }
};

exports.updateSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!skill) return res.status(404).json({ message: 'Skill not found' });
    res.json(skill);
  } catch (error) { next(error); }
};

exports.createTask = async (req, res, next) => {
  try {
    const task = await Task.create(req.body);
    // Update skill's totalTasks count
    await Skill.findByIdAndUpdate(task.skill, {
      totalTasks: await Task.countDocuments({ skill: task.skill })
    });
    res.status(201).json(task);
  } catch (error) { next(error); }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (error) { next(error); }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    await Skill.findByIdAndUpdate(task.skill, {
      totalTasks: await Task.countDocuments({ skill: task.skill })
    });
    await Submission.deleteMany({ task: task._id });
    await ChatHistory.deleteMany({ task: task._id });
    res.json({ message: 'Task deleted' });
  } catch (error) { next(error); }
};
exports.deleteSkill = async (req, res, next) => {
  try {
    const skill = await Skill.findByIdAndDelete(req.params.id);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });
    
    // Find all tasks associated with this skill
    const tasks = await Task.find({ skill: skill._id });
    const taskIds = tasks.map(t => t._id);
    
    // Cascade delete tasks, submissions, and chat histories
    await Task.deleteMany({ skill: skill._id });
    await Submission.deleteMany({ task: { $in: taskIds } });
    await ChatHistory.deleteMany({ task: { $in: taskIds } });
    
    res.json({ message: 'Skill and all associated data deleted' });
  } catch (error) { next(error); }
};

exports.getAllTasks = async (req, res, next) => {
  try {
    const tasks = await Task.find().populate('skill', 'name').sort('order');
    res.json(tasks);
  } catch (error) { next(error); }
};
