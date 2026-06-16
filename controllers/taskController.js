const Task = require('../models/Task');
const Submission = require('../models/Submission');
const ChatHistory = require('../models/ChatHistory');
const User = require('../models/User');
const { runTestCases, executeCode } = require('../services/judgeService');
const { trackEvent, getEvents, countEvents } = require('../services/eventService');
const AnalysisResult = require('../models/AnalysisResult');
const { evaluateStudentSkills, generateFeedback, PROMPT_VERSION } = require('../services/analyticsAIService');

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

    const hasError = !!(result.stderr || result.compile_output);

    // Track code run event
    await trackEvent(req.user._id, task._id, 'CODE_RUN', {
      hasError,
      executionTime: result.time
    });

    // Track error if found
    if (hasError) {
      await trackEvent(req.user._id, task._id, 'ERROR_FOUND', {
        errorType: result.compile_output ? 'compilation' : 'runtime',
        errorMessage: (result.stderr || result.compile_output || '').substring(0, 200)
      });
    }

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

    // Only persist submissions and update scores for students
    // Admin can try tasks (sees test results) but doesn't get recorded
    let submission = null;
    let totalScore = 0;

    if (req.user.role !== 'admin') {
      // Upsert submission (keep the best score)
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
      totalScore = allSubmissions.reduce((sum, s) => sum + s.score, 0);
      req.user.totalScore = totalScore;
      await req.user.updateStreak();
      
      // Save the user score to ensure it is stored in the DB
      if (req.user.isModified('totalScore')) {
        await req.user.save();
      }
    }

    res.json({
      submission: {
        status,
        score,
        bestScore: submission ? submission.score : score,
        attempts: submission ? submission.attempts : 1,
        hintsUsed,
        testResults: testResults.map(r => ({
          passed: r.passed,
          input: r.input,
          expected: r.expected,
          actual: r.actual
        })),
        isAdminPreview: req.user.role === 'admin'
      },
      totalScore
    });

    // Track submission event (after response, non-blocking) — students only
    if (req.user.role !== 'admin' && submission) {
      trackEvent(req.user._id, task._id, 'CODE_SUBMITTED', {
        status,
        score,
        attempt: submission.attempts,
        testsPassed: testResults.filter(r => r.passed).length,
        totalTests: testResults.length,
        hintsUsed,
        taskType: task.type
      }).catch(() => {});

      // Track solution completed if passed
      if (status === 'passed') {
        trackEvent(req.user._id, task._id, 'SOLUTION_COMPLETED', {
          score,
          attempts: submission.attempts,
          hintsUsed
        }).catch(() => {});
      }
    }

    // Track errors in failed submissions
    if (status === 'failed' && task.type === 'code') {
      trackEvent(req.user._id, task._id, 'ERROR_FOUND', {
        errorType: 'wrong_answer',
        testsPassed: testResults.filter(r => r.passed).length,
        totalTests: testResults.length
      }).catch(() => {});
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI feedback for a solved task (student-facing)
// @route   POST /api/tasks/:id/feedback
exports.getStudentAIFeedback = async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const userId = req.user._id;

    // 1. Verify the task exists
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // 2. Verify the student has solved the task
    const bestSubmission = await Submission.findOne({ user: userId, task: taskId }).sort('-score');
    if (!bestSubmission || bestSubmission.status !== 'passed') {
      return res.status(403).json({ message: 'You must pass the task before requesting AI feedback.' });
    }

    // 3. Check for cached feedback that is fresh
    const currentEventCount = await countEvents(userId, taskId);
    const existingFeedback = await AnalysisResult.findOne({ user: userId, task: taskId, type: 'feedback' });
    
    if (existingFeedback && existingFeedback.eventCountAtAnalysis >= currentEventCount && currentEventCount > 0) {
      return res.json({ feedback: existingFeedback.result, cached: true });
    }

    // 4. Generate feedback if not cached or stale
    const [chatHistory, events] = await Promise.all([
      ChatHistory.findOne({ user: userId, task: taskId }),
      getEvents(userId, taskId)
    ]);

    const conversation = chatHistory?.messages || [];
    const hintHistory = task.hints?.slice(0, chatHistory?.hintLevel || 0) || [];
    const studentCode = bestSubmission.code || '';

    // First evaluate skills (needed for feedback)
    const skillEvalResult = await evaluateStudentSkills(task, studentCode, conversation, hintHistory, events);
    
    // Then generate feedback
    const feedbackResult = await generateFeedback(task, studentCode, conversation, skillEvalResult);

    // Save to AnalysisResult (update both skills and feedback caches)
    const now = new Date();
    await Promise.all([
      AnalysisResult.findOneAndUpdate(
        { user: userId, task: taskId, type: 'skill_evaluation' },
        { result: skillEvalResult, promptVersion: PROMPT_VERSION, analyzedAt: now, eventCountAtAnalysis: currentEventCount },
        { upsert: true, new: true }
      ),
      AnalysisResult.findOneAndUpdate(
        { user: userId, task: taskId, type: 'feedback' },
        { result: feedbackResult, promptVersion: PROMPT_VERSION, analyzedAt: now, eventCountAtAnalysis: currentEventCount },
        { upsert: true, new: true }
      )
    ]);

    res.json({ feedback: feedbackResult, cached: false });
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
