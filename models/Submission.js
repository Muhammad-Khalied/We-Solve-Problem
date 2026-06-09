const mongoose = require('mongoose');

const testResultSchema = new mongoose.Schema({
  passed: { type: Boolean, required: true },
  input: { type: String, default: '' },
  expected: { type: String, default: '' },
  actual: { type: String, default: '' }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
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
  code: {
    type: String,
    default: ''
  },
  mathAnswer: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['passed', 'failed', 'partial', 'error'],
    default: 'failed'
  },
  score: {
    type: Number,
    default: 0
  },
  hintsUsed: {
    type: Number,
    default: 0,
    min: 0,
    max: 3
  },
  attempts: {
    type: Number,
    default: 1
  },
  testResults: [testResultSchema],
  executionTime: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index: one best submission per user per task
submissionSchema.index({ user: 1, task: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
