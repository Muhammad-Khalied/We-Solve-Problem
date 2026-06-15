const AnalysisResult = require('../models/AnalysisResult');
const StudentEvent = require('../models/StudentEvent');
const ChatHistory = require('../models/ChatHistory');
const Submission = require('../models/Submission');
const Task = require('../models/Task');
const User = require('../models/User');
const { countEvents, getEvents, getStudentEvents } = require('../services/eventService');
const {
  analyzeChatConversation,
  evaluateStudentSkills,
  generateFeedback,
  PROMPT_VERSION
} = require('../services/analyticsAIService');

// ============================================================
// TRIGGER FULL ANALYSIS
// ============================================================

// @desc    Trigger full AI analysis for a student+task
// @route   POST /api/analytics/analyze/:studentId/:taskId
exports.triggerAnalysis = async (req, res, next) => {
  try {
    const { studentId, taskId } = req.params;

    // Validate student and task exist
    const [student, task] = await Promise.all([
      User.findById(studentId),
      Task.findById(taskId)
    ]);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Check if analysis is fresh (event count hasn't changed)
    const currentEventCount = await countEvents(studentId, taskId);
    const existingAnalysis = await AnalysisResult.findOne({
      user: studentId, task: taskId, type: 'skill_evaluation'
    });

    if (existingAnalysis && existingAnalysis.eventCountAtAnalysis >= currentEventCount && currentEventCount > 0) {
      // Return cached results
      const [chatAnalysis, skillEval, feedback] = await Promise.all([
        AnalysisResult.findOne({ user: studentId, task: taskId, type: 'chat_analysis' }),
        existingAnalysis,
        AnalysisResult.findOne({ user: studentId, task: taskId, type: 'feedback' })
      ]);

      return res.json({
        cached: true,
        chatAnalysis: chatAnalysis?.result || null,
        skillEvaluation: skillEval?.result || null,
        feedback: feedback?.result || null,
        analyzedAt: existingAnalysis.analyzedAt
      });
    }

    // Gather data for analysis
    const [chatHistory, submissions, events] = await Promise.all([
      ChatHistory.findOne({ user: studentId, task: taskId }),
      Submission.find({ user: studentId, task: taskId }).sort('-updatedAt'),
      getEvents(studentId, taskId)
    ]);

    const conversation = chatHistory?.messages || [];
    const hintHistory = task.hints?.slice(0, chatHistory?.hintLevel || 0) || [];
    const bestSubmission = submissions[0];
    const studentCode = bestSubmission?.code || '';

    // Run all 3 AI analyses
    const [chatAnalysisResult, skillEvalResult] = await Promise.all([
      analyzeChatConversation(task, conversation, studentCode, hintHistory),
      evaluateStudentSkills(task, studentCode, conversation, hintHistory, events)
    ]);

    // Feedback depends on skill evaluation, so it runs after
    const feedbackResult = await generateFeedback(task, studentCode, conversation, skillEvalResult);

    // Store results (upsert)
    const now = new Date();
    await Promise.all([
      AnalysisResult.findOneAndUpdate(
        { user: studentId, task: taskId, type: 'chat_analysis' },
        { result: chatAnalysisResult, promptVersion: PROMPT_VERSION, analyzedAt: now, eventCountAtAnalysis: currentEventCount },
        { upsert: true, new: true }
      ),
      AnalysisResult.findOneAndUpdate(
        { user: studentId, task: taskId, type: 'skill_evaluation' },
        { result: skillEvalResult, promptVersion: PROMPT_VERSION, analyzedAt: now, eventCountAtAnalysis: currentEventCount },
        { upsert: true, new: true }
      ),
      AnalysisResult.findOneAndUpdate(
        { user: studentId, task: taskId, type: 'feedback' },
        { result: feedbackResult, promptVersion: PROMPT_VERSION, analyzedAt: now, eventCountAtAnalysis: currentEventCount },
        { upsert: true, new: true }
      )
    ]);

    res.json({
      cached: false,
      chatAnalysis: chatAnalysisResult,
      skillEvaluation: skillEvalResult,
      feedback: feedbackResult,
      analyzedAt: now
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// GET CACHED RESULTS
// ============================================================

// @desc    Get chat analysis for a student+task
// @route   GET /api/analytics/chat/:studentId/:taskId
exports.getChatAnalysis = async (req, res, next) => {
  try {
    const result = await AnalysisResult.findOne({
      user: req.params.studentId, task: req.params.taskId, type: 'chat_analysis'
    });
    res.json(result ? { result: result.result, analyzedAt: result.analyzedAt } : { result: null });
  } catch (error) {
    next(error);
  }
};

// @desc    Get 8-skill evaluation for a student+task
// @route   GET /api/analytics/skills/:studentId/:taskId
exports.getSkillEvaluation = async (req, res, next) => {
  try {
    const result = await AnalysisResult.findOne({
      user: req.params.studentId, task: req.params.taskId, type: 'skill_evaluation'
    });
    res.json(result ? { result: result.result, analyzedAt: result.analyzedAt } : { result: null });
  } catch (error) {
    next(error);
  }
};

// @desc    Get generated feedback for a student+task
// @route   GET /api/analytics/feedback/:studentId/:taskId
exports.getFeedback = async (req, res, next) => {
  try {
    const result = await AnalysisResult.findOne({
      user: req.params.studentId, task: req.params.taskId, type: 'feedback'
    });
    res.json(result ? { result: result.result, analyzedAt: result.analyzedAt } : { result: null });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// STUDENT OVERVIEW (across all tasks)
// ============================================================

// @desc    Get student overview with all analyses
// @route   GET /api/analytics/student/:studentId/overview
exports.getStudentOverview = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findById(studentId).select('-password');
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Get all submissions
    const submissions = await Submission.find({ user: studentId })
      .populate('task', 'title type difficulty points skill')
      .sort('-updatedAt');

    // Get all analyses for this student
    const analyses = await AnalysisResult.find({ user: studentId })
      .populate('task', 'title type difficulty');

    // Group analyses by task
    const taskAnalyses = {};
    analyses.forEach(a => {
      const taskId = a.task?._id?.toString();
      if (!taskId) return;
      if (!taskAnalyses[taskId]) {
        taskAnalyses[taskId] = { task: a.task, analyzedAt: a.analyzedAt };
      }
      taskAnalyses[taskId][a.type] = a.result;
    });

    // Get chat histories for hint data
    const chatHistories = await ChatHistory.find({ user: studentId });
    const totalHintsUsed = chatHistories.reduce((sum, ch) => sum + (ch.hintLevel || 0), 0);
    const totalAiChats = chatHistories.reduce((sum, ch) => sum + (ch.aiChatCount || 0), 0);

    // Calculate averages from skill evaluations
    const skillEvals = analyses.filter(a => a.type === 'skill_evaluation' && a.result?.overall_score);
    const avgOverallScore = skillEvals.length > 0
      ? Math.round(skillEvals.reduce((sum, a) => sum + a.result.overall_score, 0) / skillEvals.length)
      : null;

    // Calculate average per skill
    const skillAverages = {};
    skillEvals.forEach(a => {
      if (a.result?.skills) {
        a.result.skills.forEach(skill => {
          if (!skillAverages[skill.name]) skillAverages[skill.name] = { total: 0, count: 0 };
          skillAverages[skill.name].total += skill.score;
          skillAverages[skill.name].count += 1;
        });
      }
    });

    const avgSkills = Object.entries(skillAverages).map(([name, data]) => ({
      name,
      avgScore: Math.round(data.total / data.count)
    }));

    // Event summary
    const eventSummary = await StudentEvent.aggregate([
      { $match: { user: student._id } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        classSection: student.classSection,
        totalScore: student.totalScore,
        streak: student.streak
      },
      stats: {
        totalSubmissions: submissions.length,
        tasksSolved: submissions.filter(s => s.status === 'passed').length,
        totalHintsUsed,
        totalAiChats,
        avgOverallScore,
        analysesCompleted: skillEvals.length
      },
      avgSkills,
      taskAnalyses: Object.values(taskAnalyses),
      submissions: submissions.slice(0, 20),
      eventSummary: eventSummary.reduce((obj, e) => { obj[e._id] = e.count; return obj; }, {})
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student's event timeline for a specific task
// @route   GET /api/analytics/student/:studentId/tasks/:taskId/events
exports.getStudentTaskEvents = async (req, res, next) => {
  try {
    const events = await getEvents(req.params.studentId, req.params.taskId);
    res.json(events);
  } catch (error) {
    next(error);
  }
};
