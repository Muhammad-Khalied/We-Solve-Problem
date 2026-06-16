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
    let students = [];
    let currentUserRank = null;

    if (subjectId) {
      const skills = await Skill.find({ subject: subjectId });
      const skillIds = skills.map(s => s._id);
      const tasks = await Task.find({ skill: { $in: skillIds } });
      const taskIds = tasks.map(t => t._id);

      const submissions = await Submission.aggregate([
        { $match: { task: { $in: taskIds }, status: 'passed' } },
        { $group: { _id: '$user', totalScore: { $sum: '$score' }, tasksCompleted: { $sum: 1 } } },
        { $match: { totalScore: { $gt: 0 } } },
        { $sort: { totalScore: -1 } },
        { $limit: 50 }
      ]);

      const userIds = submissions.map(s => s._id);
      const users = await User.find({ _id: { $in: userIds }, role: 'student' }).select('name avatar classSection');
      const userMap = {};
      users.forEach(u => { userMap[u._id.toString()] = u; });

      let currentRank = 1;
      let lastScore = -1;
      students = submissions
        .filter(s => userMap[s._id.toString()]) // exclude non-students (admins)
        .map((s, index) => {
          if (s.totalScore !== lastScore) {
            currentRank = index + 1;
            lastScore = s.totalScore;
          }
          return {
            rank: currentRank,
            user: userMap[s._id.toString()],
            totalScore: s.totalScore,
            tasksCompleted: s.tasksCompleted
          };
        });

      // Find current user rank for this subject if not in top 50 but > 0 score
      const userEntry = students.find(s => s.user && s.user._id.toString() === req.user._id.toString());
      if (userEntry) {
        currentUserRank = userEntry.rank;
      } else {
        const allSubmissions = await Submission.aggregate([
          { $match: { task: { $in: taskIds }, status: 'passed', user: req.user._id } },
          { $group: { _id: '$user', totalScore: { $sum: '$score' } } }
        ]);
        if (allSubmissions.length > 0 && allSubmissions[0].totalScore > 0) {
          const higherScoreCount = await Submission.aggregate([
            { $match: { task: { $in: taskIds }, status: 'passed' } },
            { $group: { _id: '$user', totalScore: { $sum: '$score' } } },
            { $match: { totalScore: { $gt: allSubmissions[0].totalScore } } },
            { $count: "count" }
          ]);
          currentUserRank = higherScoreCount.length > 0 ? higherScoreCount[0].count + 1 : 1;
        }
      }

    } else {
      const rawStudents = await User.find({ role: 'student', totalScore: { $gt: 0 } })
        .select('name avatar classSection totalScore')
        .sort('-totalScore')
        .limit(50);

      let currentRank = 1;
      let lastScore = -1;
      const rankedRawStudents = rawStudents.map((student, index) => {
        if (student.totalScore !== lastScore) {
          currentRank = index + 1;
          lastScore = student.totalScore;
        }
        return { ...student.toObject(), calculatedRank: currentRank };
      });

      students = await Promise.all(
        rankedRawStudents.map(async (student) => {
          const tasksCompleted = await Submission.countDocuments({
            user: student._id,
            status: 'passed'
          });
          return {
            rank: student.calculatedRank,
            user: { id: student._id, name: student.name, avatar: student.avatar, classSection: student.classSection },
            totalScore: student.totalScore,
            tasksCompleted
          };
        })
      );

      const userEntry = students.find(s => s.user && s.user.id.toString() === req.user._id.toString());
      if (userEntry) {
        currentUserRank = userEntry.rank;
      } else if (req.user.totalScore > 0) {
        const higherScoreCount = await User.countDocuments({
          role: 'student',
          totalScore: { $gt: req.user.totalScore }
        });
        currentUserRank = higherScoreCount + 1;
      }
    }

    let filteredLeaderboard = students;
    if (req.user.role !== 'admin') {
      const top3 = students.slice(0, 3);
      const isCurrentUserInTop3 = top3.some(s => {
        const sid = s.user.id || s.user._id;
        return sid && sid.toString() === req.user._id.toString();
      });
      
      if (!isCurrentUserInTop3) {
        const currentUserEntry = students.find(s => {
          const sid = s.user.id || s.user._id;
          return sid && sid.toString() === req.user._id.toString();
        });
        if (currentUserEntry) {
          filteredLeaderboard = [...top3, currentUserEntry];
        } else if (currentUserRank) {
          filteredLeaderboard = [...top3, {
            rank: currentUserRank,
            user: { id: req.user._id, name: req.user.name, avatar: req.user.avatar, classSection: req.user.classSection },
            totalScore: req.user.totalScore,
            tasksCompleted: 0
          }];
        } else {
          filteredLeaderboard = top3;
        }
      } else {
        filteredLeaderboard = top3;
      }
    }

    res.json({
      leaderboard: filteredLeaderboard,
      currentUserRank: currentUserRank || null
    });
  } catch (error) {
    next(error);
  }
};
