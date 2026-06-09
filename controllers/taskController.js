const Task = require('../models/Task');
const Submission = require('../models/Submission');
const ChatHistory = require('../models/ChatHistory');
const User = require('../models/User');
const { runTestCases, executeCode } = require('../services/judgeService');

// @desc    Get single task (full details)
// @route   GET /api/tasks/:id
exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate({
        path: 'skill',
        select: 'name subject',
        populate: { path: 'subject', select: 'name color' }
      });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Get user's best submission for this task
    const bestSubmission = await Submission.findOne({
      user: req.user._id,
      task: task._id
    }).sort('-score');

    // Get user's hint level for this task
    const chatHistory = await ChatHistory.findOne({
      user: req.user._id,
      task: task._id
    });

    // Don't send solution unless already solved
    const taskObj = task.toObject();
    if (!bestSubmission || bestSubmission.status !== 'passed') {
      delete taskObj.solution;
    }

    // Only show visible test cases
    taskObj.testCases = taskObj.testCases.filter(tc => !tc.isHidden);

    res.json({
      task: taskObj,
      submission: bestSubmission ? {
        status: bestSubmission.status,
        score: bestSubmission.score,
        attempts: bestSubmission.attempts,
        hintsUsed: bestSubmission.hintsUsed,
        code: bestSubmission.code
      } : null,
      hintLevel: chatHistory?.hintLevel || 0
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Run code (no scoring, just execution)
// @route   POST /api/tasks/:id/run
exports.runCode = async (req, res, next) => {
  try {
    const { code, input } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task || task.type !== 'code') {
      return res.status(400).json({ message: 'Invalid code task' });
    }

    const result = await executeCode(code, task.language, input || '');

    res.json({
      output: result.stdout,
      error: result.stderr || result.compile_output,
      time: result.time,
      status: result.status
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit solution (scored)
// @route   POST /api/tasks/:id/submit
exports.submitTask = async (req, res, next) => {
  try {
    const { code, mathAnswer } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Get hint level from chat history
    const chatHistory = await ChatHistory.findOne({
      user: req.user._id,
      task: task._id
    });
    const hintsUsed = chatHistory?.hintLevel || 0;

    // Get existing submission count
    const existingSubmission = await Submission.findOne({
      user: req.user._id,
      task: task._id
    });
    const attemptNumber = existingSubmission ? existingSubmission.attempts + 1 : 1;

    let status = 'failed';
    let testResults = [];
    let score = 0;

    if (task.type === 'code') {
      // Run against all test cases
      testResults = await runTestCases(code, task.language, task.testCases);
      const allPassed = testResults.every(r => r.passed);
      const somePassed = testResults.some(r => r.passed);

      status = allPassed ? 'passed' : somePassed ? 'partial' : 'failed';
    } else {
      // Math task
      const correctAnswer = task.mathAnswer.trim().toLowerCase();
      const studentAnswer = (mathAnswer || '').trim().toLowerCase();

      if (correctAnswer === studentAnswer) {
        status = 'passed';
        testResults = [{ passed: true, expected: task.mathAnswer, actual: mathAnswer }];
      } else {
        testResults = [{ passed: false, expected: '[hidden]', actual: mathAnswer }];
      }
    }

    // Calculate score
    if (status === 'passed') {
      score = calculateScore(task.points, hintsUsed, attemptNumber);
    } else if (status === 'partial') {
      const passedCount = testResults.filter(r => r.passed).length;
      const ratio = passedCount / testResults.length;
      score = Math.round(task.points * ratio * 0.5); // partial credit
    }

    // Upsert submission (keep the best score)
    let submission;
    if (existingSubmission) {
      submission = await Submission.findOneAndUpdate(
        { user: req.user._id, task: task._id },
        {
          $set: {
            code: code || '',
            mathAnswer: mathAnswer || '',
            status: existingSubmission.score > score ? existingSubmission.status : status,
            score: Math.max(existingSubmission.score, score),
            hintsUsed,
            testResults
          },
          $inc: { attempts: 1 }
        },
        { new: true }
      );
    } else {
      submission = await Submission.create({
        user: req.user._id,
        task: task._id,
        code: code || '',
        mathAnswer: mathAnswer || '',
        status,
        score,
        hintsUsed,
        testResults,
        attempts: 1
      });
    }

    // Update user's total score & streak
    const allSubmissions = await Submission.find({ user: req.user._id, status: 'passed' });
    const totalScore = allSubmissions.reduce((sum, s) => sum + s.score, 0);
    req.user.totalScore = totalScore;
    await req.user.updateStreak();
    
    // Save the user score to ensure it is stored in the DB (in case updateStreak didn't trigger a save)
    if (req.user.isModified('totalScore')) {
      await req.user.save();
    }

    res.json({
      submission: {
        status,
        score,
        bestScore: submission.score,
        attempts: submission.attempts,
        hintsUsed,
        testResults: testResults.map(r => ({
          passed: r.passed,
          input: r.input,
          expected: r.expected,
          actual: r.actual
        }))
      },
      totalScore
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate score based on base points, hints used, and attempt number.
 * - Hint penalty: Hint 1 → -10%, Hint 2 → -20%, Hint 3 → -30% (cumulative)
 * - First-try bonus: +25%
 * - Minimum: 40% of base points
 */
function calculateScore(basePoints, hintsUsed, attemptNumber) {
  let score = basePoints;

  // Hint penalties (cumulative)
  const hintPenalties = [0, 0.10, 0.30, 0.60]; // cumulative: 0%, 10%, 30%, 60%
  score -= basePoints * (hintPenalties[hintsUsed] || 0);

  // First-try bonus
  if (attemptNumber === 1) {
    score += basePoints * 0.25;
  }

  // Ensure minimum 40%
  score = Math.max(score, basePoints * 0.4);

  return Math.round(score);
}
