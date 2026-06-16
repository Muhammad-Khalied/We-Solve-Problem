const Task = require('../models/Task');
const Skill = require('../models/Skill');
const Subject = require('../models/Subject');
const { generateContent } = require('../services/contentAIService');

// @desc    Chat with content generator AI
// @route   POST /api/admin/content-ai/chat
exports.contentAIChat = async (req, res, next) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Messages array is required' });
    }

    // Only pass user/assistant messages to the AI
    const chatMessages = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));

    const result = await generateContent(chatMessages);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a generated skill and its tasks — save to database
// @route   POST /api/admin/content-ai/accept
exports.acceptGeneratedContent = async (req, res, next) => {
  try {
    const { skill: skillData, subjectId } = req.body;

    if (!skillData || !subjectId) {
      return res.status(400).json({ message: 'skill and subjectId are required' });
    }

    // Verify subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    // Create the skill
    const skill = await Skill.create({
      name: skillData.name,
      description: skillData.description,
      subject: subjectId,
      icon: skillData.icon || '🎯',
      difficulty: skillData.difficulty || 'beginner',
      order: skillData.order || 0
    });

    // Create tasks under this skill
    const createdTasks = [];
    if (skillData.tasks && Array.isArray(skillData.tasks)) {
      for (let i = 0; i < skillData.tasks.length; i++) {
        const t = skillData.tasks[i];
        const task = await Task.create({
          skill: skill._id,
          title: t.title,
          description: t.description,
          type: t.type || 'code',
          difficulty: t.difficulty || 'easy',
          points: t.points || 10,
          order: i,
          // Code fields
          starterCode: t.starterCode || '',
          language: t.language || 'python',
          testCases: t.testCases || [],
          // Math fields
          mathAnswer: t.mathAnswer || '',
          mathOptions: t.mathOptions || [],
          mathType: t.mathType || 'numeric',
          // Common
          hints: t.hints || [],
          solution: t.solution || '',
          explanation: t.explanation || ''
        });
        createdTasks.push(task);
      }
    }

    // Update skill's totalTasks
    skill.totalTasks = createdTasks.length;
    await skill.save();

    res.status(201).json({
      message: `Created skill "${skill.name}" with ${createdTasks.length} tasks`,
      skill,
      tasks: createdTasks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept a single generated task — save to database under an existing skill
// @route   POST /api/admin/content-ai/accept-task
exports.acceptGeneratedTask = async (req, res, next) => {
  try {
    const { task: taskData, skillId } = req.body;

    if (!taskData || !skillId) {
      return res.status(400).json({ message: 'task and skillId are required' });
    }

    const skill = await Skill.findById(skillId);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });

    const task = await Task.create({
      skill: skillId,
      title: taskData.title,
      description: taskData.description,
      type: taskData.type || 'code',
      difficulty: taskData.difficulty || 'easy',
      points: taskData.points || 10,
      order: taskData.order || 0,
      starterCode: taskData.starterCode || '',
      language: taskData.language || 'python',
      testCases: taskData.testCases || [],
      mathAnswer: taskData.mathAnswer || '',
      mathOptions: taskData.mathOptions || [],
      mathType: taskData.mathType || 'numeric',
      hints: taskData.hints || [],
      solution: taskData.solution || '',
      explanation: taskData.explanation || ''
    });

    // Update skill totalTasks count
    skill.totalTasks = await Task.countDocuments({ skill: skillId });
    await skill.save();

    res.status(201).json({
      message: `Task "${task.title}" added to skill "${skill.name}"`,
      task
    });
  } catch (error) {
    next(error);
  }
};
