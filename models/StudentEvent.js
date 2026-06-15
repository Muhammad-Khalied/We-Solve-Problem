const mongoose = require('mongoose');

const studentEventSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: [
      'HINT_USED',
      'CHAT_MESSAGE',
      'CODE_SUBMITTED',
      'CODE_RUN',
      'ERROR_FOUND',
      'SOLUTION_COMPLETED',
      'TASK_OPENED',
      'TASK_CLOSED'
    ],
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for querying events by user+task (most common query)
studentEventSchema.index({ user: 1, task: 1, type: 1 });

// Index for querying a user's recent events across all tasks
studentEventSchema.index({ user: 1, createdAt: -1 });

// Index for counting events efficiently (used for cache staleness check)
studentEventSchema.index({ user: 1, task: 1, createdAt: -1 });

module.exports = mongoose.model('StudentEvent', studentEventSchema);
