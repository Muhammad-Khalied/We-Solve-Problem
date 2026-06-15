const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const chatHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  messages: [messageSchema],
  hintLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  aiChatCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  }
}, {
  timestamps: true
});

// One chat history per user per task
chatHistorySchema.index({ user: 1, task: 1 }, { unique: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
