const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  avatar: {
    type: String,
    default: ''
  },
  classSection: {
    type: String,
    required: [true, 'Class Section is required'],
    validate: {
      validator: function(val) {
        if (this.role === 'admin') return true;
        return ['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C'].includes(val);
      },
      message: 'Please select a valid class section (e.g. 1A, 2B)'
    }
  },
  totalScore: {
    type: Number,
    default: 0
  },
  streak: {
    current: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update activity streak method
userSchema.methods.updateStreak = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastActive = this.streak.lastActiveDate ? new Date(this.streak.lastActiveDate) : null;
  
  if (lastActive) {
    lastActive.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      this.streak.current += 1;
      this.streak.lastActiveDate = new Date();
      await this.save();
    } else if (diffDays > 1) {
      this.streak.current = 1;
      this.streak.lastActiveDate = new Date();
      await this.save();
    } else if (diffDays === 0 && this.streak.current === 0) {
      this.streak.current = 1;
      this.streak.lastActiveDate = new Date();
      await this.save();
    }
  } else {
    this.streak.current = 1;
    this.streak.lastActiveDate = new Date();
    await this.save();
  }
};

module.exports = mongoose.model('User', userSchema);
