const mongoose = require('mongoose');

let memoryServer = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;
    let isMemoryDB = false;

    // Try connecting to the configured MongoDB URI
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
      console.log(`   Database: ${mongoose.connection.db.databaseName}`);
      console.log('   💾 Data is PERSISTENT — your students and scores are saved.');
    } catch (err) {
      console.log('⚠️  Could not connect to MongoDB at', uri);
      console.log('   Error:', err.message);
      
      // Fallback to in-memory database for development
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        console.log('📦 Starting in-memory MongoDB (data will NOT persist across restarts)...');
        memoryServer = await MongoMemoryServer.create();
        uri = memoryServer.getUri();
        await mongoose.connect(uri);
        console.log('✅ In-memory MongoDB connected');
        isMemoryDB = true;
      } catch (memErr) {
        console.error('❌ MongoDB not available and mongodb-memory-server not installed.');
        console.error('   Please either:');
        console.error('   1. Use MongoDB Atlas (update MONGODB_URI in .env)');
        console.error('   2. Install MongoDB locally and start it');
        console.error('   3. Run: npm install mongodb-memory-server');
        process.exit(1);
      }
    }

    // ONLY auto-seed when using in-memory database (temporary dev data)
    // Real databases are NEVER auto-seeded — use `npm run seed` to seed once
    if (isMemoryDB) {
      try {
        console.log('🌱 Auto-seeding in-memory database...');
        await seedDatabase();
      } catch (seedErr) {
        console.error('⚠️  Seeding error:', seedErr.message);
      }
    }
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Seed function — creates admin, students, subjects, skills, and tasks
async function seedDatabase() {
  const User = require('../models/User');
  const Subject = require('../models/Subject');
  const Skill = require('../models/Skill');
  const Task = require('../models/Task');
  const bcrypt = require('bcryptjs');

  // Check if data already exists (don't re-seed)
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    console.log('   Database already has data — skipping seed.');
    return;
  }

  // Admin
  await User.create({
    name: 'Mr. Hamad', email: 'admin@wesolve.com',
    password: 'admin123', role: 'admin', classSection: 'Admin'
  });

  // Students
  const hash = await bcrypt.hash('student123', 12);
  await User.insertMany([
    { name: 'Ahmed Hassan', email: 'ahmed@student.com', password: hash, role: 'student', classSection: '2A' },
    { name: 'Sara Mohamed', email: 'sara@student.com', password: hash, role: 'student', classSection: '2A' },
    { name: 'Omar Ali', email: 'omar@student.com', password: hash, role: 'student', classSection: '2B' },
  ]);

  // Subjects
  const programming = await Subject.create({ name: 'Programming', description: 'Learn programming problem-solving skills.', icon: '💻', color: '#6C63FF', order: 1 });
  const math = await Subject.create({ name: 'Mathematics', description: 'Master mathematical thinking.', icon: '📐', color: '#FF6B6B', order: 2 });

  // Programming Skills
  const variables = await Skill.create({ subject: programming._id, name: 'Variables & Data Types', description: 'Store and manipulate data.', icon: '📦', order: 1, difficulty: 'beginner' });
  const conditions = await Skill.create({ subject: programming._id, name: 'Conditionals', description: 'Make decisions with if/else.', icon: '🔀', order: 2, difficulty: 'beginner', prerequisites: [variables._id] });
  const loops = await Skill.create({ subject: programming._id, name: 'Loops', description: 'Repeat actions with loops.', icon: '🔄', order: 3, difficulty: 'intermediate', prerequisites: [conditions._id] });
  const functions = await Skill.create({ subject: programming._id, name: 'Functions', description: 'Organize code into reusable blocks.', icon: '⚡', order: 4, difficulty: 'intermediate', prerequisites: [loops._id] });
  const arrays = await Skill.create({ subject: programming._id, name: 'Arrays & Lists', description: 'Work with collections of data.', icon: '📋', order: 5, difficulty: 'advanced', prerequisites: [functions._id] });

  // Math Skills
  const algebra = await Skill.create({ subject: math._id, name: 'Algebra Basics', description: 'Solve equations and expressions.', icon: '🔢', order: 1, difficulty: 'beginner' });
  const geometry = await Skill.create({ subject: math._id, name: 'Geometry', description: 'Shapes, areas, and relationships.', icon: '📐', order: 2, difficulty: 'beginner' });
  const logic = await Skill.create({ subject: math._id, name: 'Logic & Sets', description: 'Logical thinking and set operations.', icon: '🧠', order: 3, difficulty: 'intermediate', prerequisites: [algebra._id] });

  // Programming Tasks
  await Task.insertMany([
    {
      skill: variables._id, title: 'Hello World', type: 'code', difficulty: 'easy', points: 10,
      description: 'Write a Python program that prints "Hello, World!" to the screen.',
      starterCode: '# Write your code here\n', language: 'python', order: 1,
      testCases: [{ input: '', expectedOutput: 'Hello, World!', isHidden: false }],
      hints: ['Think about which function prints text.', 'The function is called print().', 'Use: print("Hello, World!")'],
      solution: 'print("Hello, World!")'
    },
    {
      skill: variables._id, title: 'Sum of Two Numbers', type: 'code', difficulty: 'easy', points: 10,
      description: 'Read two integers from input and print their sum.',
      starterCode: '# Read two numbers and print their sum\n', language: 'python', order: 2,
      testCases: [{ input: '3\n5', expectedOutput: '8', isHidden: false }, { input: '10\n20', expectedOutput: '30', isHidden: false }, { input: '-5\n5', expectedOutput: '0', isHidden: true }],
      hints: ['Use input() to read values.', 'Convert input to int using int().', 'a = int(input())\nb = int(input())\nprint(a + b)'],
      solution: 'a = int(input())\nb = int(input())\nprint(a + b)'
    },
    {
      skill: variables._id, title: 'Swap Two Variables', type: 'code', difficulty: 'medium', points: 20,
      description: 'Read two values and print them swapped.',
      starterCode: '# Read two values and print them swapped\n', language: 'python', order: 3,
      testCases: [{ input: 'hello\nworld', expectedOutput: 'world\nhello', isHidden: false }],
      hints: ['Use a temporary variable.', 'In Python: a, b = b, a', 'Read both, then print in reverse order.'],
      solution: 'a = input()\nb = input()\nprint(b)\nprint(a)'
    },
    {
      skill: conditions._id, title: 'Even or Odd', type: 'code', difficulty: 'easy', points: 10,
      description: 'Read an integer and print "Even" if even, or "Odd" if odd.',
      starterCode: '# Check if a number is even or odd\n', language: 'python', order: 1,
      testCases: [{ input: '4', expectedOutput: 'Even', isHidden: false }, { input: '7', expectedOutput: 'Odd', isHidden: false }, { input: '0', expectedOutput: 'Even', isHidden: true }],
      hints: ['Use modulo (%) to check divisibility.', 'If n % 2 == 0, it is even.', 'n = int(input())\nif n % 2 == 0: print("Even")\nelse: print("Odd")'],
      solution: 'n = int(input())\nif n % 2 == 0:\n    print("Even")\nelse:\n    print("Odd")'
    },
    {
      skill: conditions._id, title: 'Grade Calculator', type: 'code', difficulty: 'medium', points: 20,
      description: 'Read a score (0-100) and print the grade:\n- 90-100: A\n- 80-89: B\n- 70-79: C\n- 60-69: D\n- Below 60: F',
      starterCode: '# Calculate grade from score\n', language: 'python', order: 2,
      testCases: [{ input: '95', expectedOutput: 'A', isHidden: false }, { input: '85', expectedOutput: 'B', isHidden: false }, { input: '42', expectedOutput: 'F', isHidden: true }],
      hints: ['Use if/elif/else to check ranges.', 'Start from the highest grade.', 'Check >= 90 first, then >= 80, etc.'],
      solution: 'score = int(input())\nif score >= 90: print("A")\nelif score >= 80: print("B")\nelif score >= 70: print("C")\nelif score >= 60: print("D")\nelse: print("F")'
    },
    {
      skill: loops._id, title: 'Count to N', type: 'code', difficulty: 'easy', points: 10,
      description: 'Read a positive integer N and print all numbers from 1 to N, each on a new line.',
      starterCode: '# Print numbers from 1 to N\n', language: 'python', order: 1,
      testCases: [{ input: '5', expectedOutput: '1\n2\n3\n4\n5', isHidden: false }, { input: '3', expectedOutput: '1\n2\n3', isHidden: true }],
      hints: ['Use a for loop with range().', 'range(1, n+1) gives 1 to n.', 'for i in range(1, n+1): print(i)'],
      solution: 'n = int(input())\nfor i in range(1, n+1):\n    print(i)'
    },
    {
      skill: loops._id, title: 'Sum of N Numbers', type: 'code', difficulty: 'medium', points: 20,
      description: 'Read N, then read N integers and print their sum.',
      starterCode: '# Read N numbers and print their sum\n', language: 'python', order: 2,
      testCases: [{ input: '3\n1\n2\n3', expectedOutput: '6', isHidden: false }, { input: '4\n10\n20\n30\n40', expectedOutput: '100', isHidden: true }],
      hints: ['First read N, then loop N times.', 'Keep a running total.', 'Initialize total = 0 before the loop.'],
      solution: 'n = int(input())\ntotal = 0\nfor i in range(n):\n    total += int(input())\nprint(total)'
    },
    {
      skill: functions._id, title: 'Max of Three', type: 'code', difficulty: 'medium', points: 20,
      description: 'Write a function max_of_three(a, b, c) that returns the maximum. Read three integers and print the result.',
      starterCode: 'def max_of_three(a, b, c):\n    # Your code here\n    pass\n\na = int(input())\nb = int(input())\nc = int(input())\nprint(max_of_three(a, b, c))\n',
      language: 'python', order: 1,
      testCases: [{ input: '1\n2\n3', expectedOutput: '3', isHidden: false }, { input: '10\n5\n8', expectedOutput: '10', isHidden: false }],
      hints: ['Compare a with b, then with c.', 'Use Python\'s built-in max().', 'return max(a, b, c)'],
      solution: 'def max_of_three(a, b, c):\n    return max(a, b, c)'
    },
    {
      skill: arrays._id, title: 'Find the Maximum', type: 'code', difficulty: 'medium', points: 20,
      description: 'Read N numbers into a list and print the maximum value.',
      starterCode: '# Find the maximum in a list\n', language: 'python', order: 1,
      testCases: [{ input: '5\n3 1 4 1 5', expectedOutput: '5', isHidden: false }],
      hints: ['Read numbers using split().', 'Use max() or loop to find largest.', 'nums = list(map(int, input().split()))'],
      solution: 'n = int(input())\nnums = list(map(int, input().split()))\nprint(max(nums))'
    },
    {
      skill: arrays._id, title: 'Reverse a List', type: 'code', difficulty: 'medium', points: 20,
      description: 'Read N numbers and print them in reverse order, space-separated.',
      starterCode: '# Reverse a list of numbers\n', language: 'python', order: 2,
      testCases: [{ input: '5\n1 2 3 4 5', expectedOutput: '5 4 3 2 1', isHidden: false }],
      hints: ['Read the list, then reverse it.', 'Use slicing [::-1].', 'print(" ".join(map(str, nums[::-1])))'],
      solution: 'n = int(input())\nnums = list(map(int, input().split()))\nprint(" ".join(map(str, nums[::-1])))'
    }
  ]);

  // Math Tasks
  await Task.insertMany([
    {
      skill: algebra._id, title: 'Solve for x', type: 'math', difficulty: 'easy', points: 10,
      description: 'Solve the equation: **2x + 6 = 14**\n\nWhat is the value of x?',
      mathType: 'numeric', mathAnswer: '4', order: 1,
      hints: ['Move constants to one side.', 'Subtract 6 from both sides: 2x = 8', 'Divide both sides by 2.'],
      solution: 'x = 4', explanation: '2x + 6 = 14 → 2x = 8 → x = 4'
    },
    {
      skill: algebra._id, title: 'Simplify Expression', type: 'math', difficulty: 'medium', points: 20,
      description: 'Simplify: **3(x + 2) - 2(x - 1)**\n\nOptions:',
      mathType: 'multiple-choice', mathOptions: ['x + 8', 'x + 4', '5x + 4', 'x + 6'],
      mathAnswer: 'x + 8', order: 2,
      hints: ['Distribute the 3 and -2.', '3x + 6 - 2x + 2 = ?', 'Combine like terms.'],
      solution: 'x + 8', explanation: '3(x+2) - 2(x-1) = 3x + 6 - 2x + 2 = x + 8'
    },
    {
      skill: geometry._id, title: 'Area of Triangle', type: 'math', difficulty: 'easy', points: 10,
      description: 'A triangle has a base of **10 cm** and a height of **6 cm**.\n\nWhat is its area in cm²?',
      mathType: 'numeric', mathAnswer: '30', order: 1,
      hints: ['Area = (base × height) / 2', 'Plug in: (10 × 6) / 2', '60 / 2 = ?'],
      solution: '30', explanation: 'Area = (10 × 6) / 2 = 30 cm²'
    },
    {
      skill: geometry._id, title: 'Circle Circumference', type: 'math', difficulty: 'medium', points: 20,
      description: 'A circle has a radius of **7 cm**. What is its circumference?\nUse π = 3.14.',
      mathType: 'multiple-choice', mathOptions: ['43.96', '21.98', '153.86', '44.00'],
      mathAnswer: '43.96', order: 2,
      hints: ['C = 2πr', '2 × 3.14 × 7 = ?', '6.28 × 7'],
      solution: '43.96', explanation: 'C = 2πr = 2 × 3.14 × 7 = 43.96 cm'
    },
    {
      skill: logic._id, title: 'Truth Table AND', type: 'math', difficulty: 'medium', points: 20,
      description: 'In a truth table for A AND B, how many rows result in TRUE?',
      mathType: 'numeric', mathAnswer: '1', order: 1,
      hints: ['List all combinations of A and B.', 'AND is true only when both are true.', 'FF=F, FT=F, TF=F, TT=T → 1'],
      solution: '1', explanation: 'AND is TRUE only when both A=TRUE and B=TRUE.'
    }
  ]);

  // Update totalTasks
  for (const skill of [variables, conditions, loops, functions, arrays, algebra, geometry, logic]) {
    const count = await Task.countDocuments({ skill: skill._id });
    await Skill.findByIdAndUpdate(skill._id, { totalTasks: count });
  }

  console.log('✅ Database seeded!');
  console.log('   Admin: admin@wesolve.com / admin123');
  console.log('   Student: ahmed@student.com / student123');
}

module.exports = connectDB;
