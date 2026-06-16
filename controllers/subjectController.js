const Subject = require('../models/Subject');
const Skill = require('../models/Skill');
const Submission = require('../models/Submission');
const Task = require('../models/Task');

// @desc    Get all subjects
// @route   GET /api/subjects
exports.getSubjects = async (req, res, next) => {
  try {
    const subjects = await Subject.find().sort('order');
    res.json(subjects);
  } catch (error) {
    next(error);
  }
};

// @desc    Get single subject with skill count
// @route   GET /api/subjects/:id
exports.getSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    const skillCount = await Skill.countDocuments({ subject: subject._id });
    res.json({ ...subject.toObject(), skillCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Get skills for a subject with user progress
// @route   GET /api/subjects/:id/skills
exports.getSubjectSkills = async (req, res, next) => {
  try {
    const skills = await Skill.find({ subject: req.params.id })
      .populate('prerequisites', 'name')
      .sort('order');

    // Get user's progress for each skill
    const skillsWithProgress = await Promise.all(
      skills.map(async (skill) => {
        const tasks = await Task.find({ skill: skill._id });
        const taskIds = tasks.map(t => t._id);

        const completedSubmissions = await Submission.find({
          user: req.user._id,
          task: { $in: taskIds },
          status: 'passed'
        }).distinct('task');

        // Check if prerequisites are met based on accessMode
        let unlocked = true;
        
        if (skill.accessMode === 'locked') {
          unlocked = false;
        } else if (skill.accessMode === 'unlocked') {
          unlocked = true;
        } else if (skill.prerequisites && skill.prerequisites.length > 0) {
          for (const prereq of skill.prerequisites) {
            const prereqTasks = await Task.find({ skill: prereq._id || prereq });
            const prereqTaskIds = prereqTasks.map(t => t._id);
            const prereqCompleted = await Submission.find({
              user: req.user._id,
              task: { $in: prereqTaskIds },
              status: 'passed'
            }).distinct('task');
            
            // If the prerequisite has no tasks, it's considered completed. 
            // If it has tasks, all must be completed.
            if (prereqTasks.length > 0 && prereqCompleted.length < prereqTasks.length) {
              unlocked = false;
              break;
            }
          }
        }

        return {
          ...skill.toObject(),
          totalTasks: tasks.length,
          completedTasks: completedSubmissions.length,
          progress: tasks.length > 0 ? Math.round((completedSubmissions.length / tasks.length) * 100) : 0,
          status: !unlocked ? 'locked' : completedSubmissions.length === tasks.length && tasks.length > 0 ? 'completed' : completedSubmissions.length > 0 ? 'in-progress' : 'unlocked'
        };
      })
    );

    res.json(skillsWithProgress);
  } catch (error) {
    next(error);
  }
};
