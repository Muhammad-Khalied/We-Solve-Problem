const ChatHistory = require('../models/ChatHistory');
const Task = require('../models/Task');
const { sendMessage } = require('../services/geminiService');

// @desc    Send message to AI tutor
// @route   POST /api/chat/:taskId
exports.sendChatMessage = async (req, res, next) => {
  try {
    const { message, currentCode, currentAnswer } = req.body;
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    let chatHistory = await ChatHistory.findOne({
      user: req.user._id, task: task._id
    });
    if (!chatHistory) {
      chatHistory = await ChatHistory.create({
        user: req.user._id, task: task._id, messages: [], hintLevel: 0
      });
    }

    chatHistory.messages.push({ role: 'user', content: message });

    const aiResponse = await sendMessage(
      task, chatHistory.messages, chatHistory.hintLevel, message, currentCode, currentAnswer
    );

    chatHistory.messages.push({ role: 'assistant', content: aiResponse });
    await chatHistory.save();

    res.json({ response: aiResponse, hintLevel: chatHistory.hintLevel });
  } catch (error) {
    next(error);
  }
};

// @desc    Get chat history for a task
// @route   GET /api/chat/:taskId/history
exports.getChatHistory = async (req, res, next) => {
  try {
    const chatHistory = await ChatHistory.findOne({
      user: req.user._id, task: req.params.taskId
    });
    res.json(chatHistory || { messages: [], hintLevel: 0 });
  } catch (error) {
    next(error);
  }
};

// @desc    Request next hint level
// @route   POST /api/chat/:taskId/hint
exports.requestHint = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    let chatHistory = await ChatHistory.findOne({
      user: req.user._id, task: task._id
    });
    if (!chatHistory) {
      chatHistory = await ChatHistory.create({
        user: req.user._id, task: task._id, messages: [], hintLevel: 0
      });
    }

    if (chatHistory.hintLevel >= 3) {
      return res.status(400).json({ message: 'Maximum hints reached', hintLevel: 3 });
    }

    chatHistory.hintLevel += 1;
    const hintText = task.hints[chatHistory.hintLevel - 1] || 'No more hints available.';
    
    chatHistory.messages.push({ role: 'user', content: `[Hint ${chatHistory.hintLevel} requested]` });
    chatHistory.messages.push({ role: 'assistant', content: `💡 **Hint ${chatHistory.hintLevel}:** ${hintText}` });
    await chatHistory.save();

    res.json({
      hint: hintText,
      hintLevel: chatHistory.hintLevel,
      message: `💡 **Hint ${chatHistory.hintLevel}:** ${hintText}`
    });
  } catch (error) {
    next(error);
  }
};
