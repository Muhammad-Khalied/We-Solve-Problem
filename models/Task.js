const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, default: '' },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  skill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['code', 'math'],
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'easy'
  },
  points: {
    type: Number,
    required: true,
    default: 10
  },
  // Code task fields
  starterCode: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    enum: ['python', 'javascript', 'cpp'],
    default: 'python'
  },
  testCases: [testCaseSchema],

  // Math task fields
  mathAnswer: {
    type: String,
    default: ''
  },
  mathOptions: [{
    type: String
  }],
  mathType: {
    type: String,
    enum: ['numeric', 'multiple-choice', 'expression'],
    default: 'numeric'
  },

  // Hints (3 levels as per Guidebook)
  hints: [{
    type: String
  }],

  // Solution & explanation
  solution: {
    type: String,
    default: ''
  },
  explanation: {
    type: String,
    default: ''
  },

  order: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Task', taskSchema);
