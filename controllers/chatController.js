const ChatHistory = require('../models/ChatHistory');
const Task = require('../models/Task');
const { sendMessage } = require('../services/geminiService');
const { trackEvent } = require('../services/eventService');

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
        user: req.user._id, task: task._id, messages: [], hintLevel: 0, aiChatCount: 0
      });
    }

    if (chatHistory.hintLevel < 3) {
      return res.status(400).json({ message: 'You must use all 3 hints before unlocking the AI Tutor.' });
    }

    if (chatHistory.aiChatCount >= 3) {
      return res.status(400).json({ message: 'You have reached the maximum of 3 AI chats.' });
    }

    chatHistory.messages.push({ role: 'user', content: message });
    chatHistory.aiChatCount += 1;

    const aiResponse = await sendMessage(
      task, chatHistory.messages, chatHistory.hintLevel, message, currentCode, currentAnswer
    );

    chatHistory.messages.push({ role: 'assistant', content: aiResponse });
    await chatHistory.save();

    // Track chat message event
    await trackEvent(req.user._id, task._id, 'CHAT_MESSAGE', {
      messageLength: message.length,
      hintLevel: chatHistory.hintLevel,
      aiChatCount: chatHistory.aiChatCount
    });

    res.json({ response: aiResponse, hintLevel: chatHistory.hintLevel, aiChatCount: chatHistory.aiChatCount });
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
    res.json(chatHistory || { messages: [], hintLevel: 0, aiChatCount: 0 });
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
        user: req.user._id, task: task._id, messages: [], hintLevel: 0, aiChatCount: 0
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

    // Track hint usage event
    await trackEvent(req.user._id, task._id, 'HINT_USED', {
      hintLevel: chatHistory.hintLevel,
      hintText
    });

    res.json({
      hint: hintText,
      hintLevel: chatHistory.hintLevel,
      aiChatCount: chatHistory.aiChatCount,
      message: `💡 **Hint ${chatHistory.hintLevel}:** ${hintText}`
    });
  } catch (error) {
    next(error);
  }
};
