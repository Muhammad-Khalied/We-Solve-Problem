const mongoose = require('mongoose');

const analysisResultSchema = new mongoose.Schema({
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
    enum: ['chat_analysis', 'skill_evaluation', 'feedback'],
    required: true
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  promptVersion: {
    type: String,
    default: 'v1.0'
  },
  analyzedAt: {
    type: Date,
    default: Date.now
  },
  // Used to detect staleness: if more events exist than when analysis ran, it's stale
  eventCountAtAnalysis: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// One result per user+task+type (upsert pattern)
analysisResultSchema.index({ user: 1, task: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('AnalysisResult', analysisResultSchema);
