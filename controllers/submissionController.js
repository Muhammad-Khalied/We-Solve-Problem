const Submission = require('../models/Submission');
const User = require('../models/User');
const Task = require('../models/Task');
const Skill = require('../models/Skill');
const Subject = require('../models/Subject');

// @desc    Get current user's submissions
// @route   GET /api/submissions/my
exports.getMySubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({ user: req.user._id })
      .populate({
        path: 'task',
        select: 'title type difficulty points skill',
        populate: { path: 'skill', select: 'name subject' }
      })
      .sort('-updatedAt')
      .limit(50);
    res.json(submissions);
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's dashboard stats
// @route   GET /api/submissions/stats
exports.getMyStats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const totalTasks = await Task.countDocuments();
    const completedTasks = await Submission.distinct('task', {
      user: userId,
      status: 'passed'
    });

    // Per-subject progress
    const subjects = await Subject.find().sort('order');
    const subjectProgress = await Promise.all(
      subjects.map(async (subject) => {
        const skills = await Skill.find({ subject: subject._id });
        const skillIds = skills.map(s => s._id);
        const tasks = await Task.find({ skill: { $in: skillIds } });
        const taskIds = tasks.map(t => t._id);
        const completed = await Submission.distinct('task', {
          user: userId,
          task: { $in: taskIds },
          status: 'passed'
        });
        return {
          subject: { id: subject._id, name: subject.name, color: subject.color, icon: subject.icon },
          totalTasks: taskIds.length,
          completedTasks: completed.length,
          progress: taskIds.length > 0 ? Math.round((completed.length / taskIds.length) * 100) : 0
        };
      })
    );

    // Skills mastered
    const allSkills = await Skill.find();
    let skillsMastered = 0;
    for (const skill of allSkills) {
      const skillTasks = await Task.find({ skill: skill._id });
      if (skillTasks.length === 0) continue;
      const skillTaskIds = skillTasks.map(t => t._id);
      const completedSkillTasks = await Submission.distinct('task', {
        user: userId,
        task: { $in: skillTaskIds },
        status: 'passed'
      });
      if (completedSkillTasks.length === skillTasks.length) {
        skillsMastered++;
      }
    }

    // Recent activity
    const recentActivity = await Submission.find({ user: userId })
      .populate('task', 'title type difficulty points')
      .sort('-updatedAt')
      .limit(10);

    res.json({
      totalScore: req.user.totalScore,
      totalTasks,
      completedTasks: completedTasks.length,
      skillsMastered,
      totalSkills: allSkills.length,
      streak: req.user.streak,
      subjectProgress,
      recentActivity
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leaderboard
// @route   GET /api/submissions/leaderboard
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { subjectId } = req.query;
    let students;

    if (subjectId) {
      const skills = await Skill.find({ subject: subjectId });
      const skillIds = skills.map(s => s._id);
      const tasks = await Task.find({ skill: { $in: skillIds } });
      const taskIds = tasks.map(t => t._id);

      const submissions = await Submission.aggregate([
        { $match: { task: { $in: taskIds }, status: 'passed' } },
        { $group: { _id: '$user', totalScore: { $sum: '$score' }, tasksCompleted: { $sum: 1 } } },
        { $sort: { totalScore: -1 } },
        { $limit: 50 }
      ]);

      const userIds = submissions.map(s => s._id);
      const users = await User.find({ _id: { $in: userIds } }).select('name avatar classSection');
      const userMap = {};
      users.forEach(u => { userMap[u._id.toString()] = u; });

      students = submissions.map((s, index) => ({
        rank: index + 1,
        user: userMap[s._id.toString()],
        totalScore: s.totalScore,
        tasksCompleted: s.tasksCompleted
      }));
    } else {
      const rawStudents = await User.find({ role: 'student' })
        .select('name avatar classSection totalScore')
        .sort('-totalScore')
        .limit(50);

      students = await Promise.all(
        rawStudents.map(async (student, index) => {
          const tasksCompleted = await Submission.countDocuments({
            user: student._id,
            status: 'passed'
          });
          return {
            rank: index + 1,
            user: { id: student._id, name: student.name, avatar: student.avatar, classSection: student.classSection },
            totalScore: student.totalScore,
            tasksCompleted
          };
        })
      );
    }

    let currentUserRank = students.findIndex(s =>
      (s.user.id || s.user._id)?.toString() === req.user._id.toString()
    ) + 1;

    // If current user is not in the top 50, calculate their actual rank
    if (!currentUserRank) {
      if (subjectId) {
        // Find rank for this specific subject
        const skills = await Skill.find({ subject: subjectId });
        const skillIds = skills.map(s => s._id);
        const tasks = await Task.find({ skill: { $in: skillIds } });
        const taskIds = tasks.map(t => t._id);

        const allSubmissions = await Submission.aggregate([
          { $match: { task: { $in: taskIds }, status: 'passed' } },
          { $group: { _id: '$user', totalScore: { $sum: '$score' } } },
          { $sort: { totalScore: -1 } }
        ]);
        const userIndex = allSubmissions.findIndex(s => s._id.toString() === req.user._id.toString());
        if (userIndex !== -1) {
          currentUserRank = userIndex + 1;
        }
      } else {
        // Find overall rank based on totalScore
        const higherScoreCount = await User.countDocuments({
          role: 'student',
          totalScore: { $gt: req.user.totalScore }
        });
        currentUserRank = higherScoreCount + 1;
      }
    }

    res.json({
      leaderboard: students,
      currentUserRank: currentUserRank || null
    });
  } catch (error) {
    next(error);
  }
};
