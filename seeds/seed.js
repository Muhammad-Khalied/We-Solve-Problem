const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

const User = require('../models/User');
const Subject = require('../models/Subject');
const Skill = require('../models/Skill');
const Task = require('../models/Task');
const Submission = require('../models/Submission');
const ChatHistory = require('../models/ChatHistory');

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Check if data already exists
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log(`⚠️  Database already has ${existingUsers} users.`);
      console.log('   This will DELETE ALL existing data (students, scores, submissions).');
      console.log('   Run with --force flag to confirm: node seeds/seed.js --force');
      if (!process.argv.includes('--force')) {
        process.exit(0);
      }
      console.log('   --force flag detected. Proceeding with data wipe...');
    }

    // Clear existing data
    await User.deleteMany({});
    await Subject.deleteMany({});
    await Skill.deleteMany({});
    await Task.deleteMany({});
    await Submission.deleteMany({});
    await ChatHistory.deleteMany({});
    console.log('Cleared existing data.');

    // Create admin user
    const admin = await User.create({
      name: 'Mr. Mohamed',
      email: 'admin@wesolve.com',
      password: 'admin123',
      role: 'admin',
      classSection: 'Admin'
    });

    // Create sample students
    const students = await User.insertMany([
      { name: 'Ahmed Hassan', email: 'ahmed@student.com', password: await bcrypt.hash('student123', 12), role: 'student', classSection: '2A' },
      { name: 'Sara Mohamed', email: 'sara@student.com', password: await bcrypt.hash('student123', 12), role: 'student', classSection: '2A' },
      { name: 'Omar Ali', email: 'omar@student.com', password: await bcrypt.hash('student123', 12), role: 'student', classSection: '2B' },
    ]);

    // =================== SUBJECTS ===================
    const programming = await Subject.create({
      name: 'Programming', description: 'Learn programming problem-solving skills step by step.',
      icon: '💻', color: '#6C63FF', order: 1
    });
    const math = await Subject.create({
      name: 'Mathematics', description: 'Master mathematical thinking and problem solving.',
      icon: '📐', color: '#FF6B6B', order: 2
    });

    // =================== PROGRAMMING SKILLS ===================
    const variables = await Skill.create({
      subject: programming._id, name: 'Variables & Data Types',
      description: 'Learn to store and manipulate different types of data.',
      icon: '📦', order: 1, difficulty: 'beginner', prerequisites: []
    });
    const conditions = await Skill.create({
      subject: programming._id, name: 'Conditionals',
      description: 'Make decisions in your code using if/else statements.',
      icon: '🔀', order: 2, difficulty: 'beginner', prerequisites: [variables._id]
    });
    const loops = await Skill.create({
      subject: programming._id, name: 'Loops',
      description: 'Repeat actions efficiently using for and while loops.',
      icon: '🔄', order: 3, difficulty: 'intermediate', prerequisites: [conditions._id]
    });
    const functions = await Skill.create({
      subject: programming._id, name: 'Functions',
      description: 'Organize code into reusable blocks.',
      icon: '⚡', order: 4, difficulty: 'intermediate', prerequisites: [loops._id]
    });
    const arrays = await Skill.create({
      subject: programming._id, name: 'Arrays & Lists',
      description: 'Work with collections of data.',
      icon: '📋', order: 5, difficulty: 'advanced', prerequisites: [functions._id]
    });

    // =================== MATH SKILLS ===================
    const algebra = await Skill.create({
      subject: math._id, name: 'Algebra Basics',
      description: 'Solve equations and understand algebraic expressions.',
      icon: '🔢', order: 1, difficulty: 'beginner', prerequisites: []
    });
    const geometry = await Skill.create({
      subject: math._id, name: 'Geometry',
      description: 'Understand shapes, areas, and geometric relationships.',
      icon: '📐', order: 2, difficulty: 'beginner', prerequisites: []
    });
    const logic = await Skill.create({
      subject: math._id, name: 'Logic & Sets',
      description: 'Think logically and understand set operations.',
      icon: '🧠', order: 3, difficulty: 'intermediate', prerequisites: [algebra._id]
    });

    // =================== PROGRAMMING TASKS ===================

    // Variables & Data Types Tasks
    await Task.insertMany([
      {
        skill: variables._id, title: 'Hello World', type: 'code', difficulty: 'easy', points: 10,
        description: 'Write a Python program that prints "Hello, World!" to the screen.',
        starterCode: '# Write your code here\n',
        language: 'python', order: 1,
        testCases: [{ input: '', expectedOutput: 'Hello, World!', isHidden: false }],
        hints: ['Think about which function prints text to the screen.', 'The function is called print().', 'Use: print("Hello, World!")'],
        solution: 'print("Hello, World!")',
        explanation: 'The print() function outputs text to the console.'
      },
      {
        skill: variables._id, title: 'Sum of Two Numbers', type: 'code', difficulty: 'easy', points: 10,
        description: 'Read two integers from input and print their sum.\n\n**Input:** Two integers on separate lines\n**Output:** Their sum',
        starterCode: '# Read two numbers and print their sum\n',
        language: 'python', order: 2,
        testCases: [
          { input: '3\n5', expectedOutput: '8', isHidden: false },
          { input: '10\n20', expectedOutput: '30', isHidden: false },
          { input: '-5\n5', expectedOutput: '0', isHidden: true }
        ],
        hints: ['Use input() to read values from the user.', 'Remember to convert input to integers using int().', 'a = int(input())\nb = int(input())\nprint(a + b)'],
        solution: 'a = int(input())\nb = int(input())\nprint(a + b)'
      },
      {
        skill: variables._id, title: 'Swap Two Variables', type: 'code', difficulty: 'medium', points: 20,
        description: 'Read two values and print them swapped.\n\n**Input:** Two values on separate lines\n**Output:** The values swapped, each on a new line',
        starterCode: '# Read two values and print them swapped\n',
        language: 'python', order: 3,
        testCases: [
          { input: 'hello\nworld', expectedOutput: 'world\nhello', isHidden: false },
          { input: '1\n2', expectedOutput: '2\n1', isHidden: true }
        ],
        hints: ['You can use a temporary variable to hold one value.', 'In Python, you can swap with: a, b = b, a', 'Read both values, then print them in reverse order.'],
        solution: 'a = input()\nb = input()\nprint(b)\nprint(a)'
      }
    ]);

    // Conditionals Tasks
    await Task.insertMany([
      {
        skill: conditions._id, title: 'Even or Odd', type: 'code', difficulty: 'easy', points: 10,
        description: 'Read an integer and print "Even" if it is even, or "Odd" if it is odd.',
        starterCode: '# Check if a number is even or odd\n',
        language: 'python', order: 1,
        testCases: [
          { input: '4', expectedOutput: 'Even', isHidden: false },
          { input: '7', expectedOutput: 'Odd', isHidden: false },
          { input: '0', expectedOutput: 'Even', isHidden: true }
        ],
        hints: ['Use the modulo operator (%) to check divisibility by 2.', 'If number % 2 == 0, it is even.', 'n = int(input())\nif n % 2 == 0:\n    print("Even")\nelse:\n    print("Odd")'],
        solution: 'n = int(input())\nif n % 2 == 0:\n    print("Even")\nelse:\n    print("Odd")'
      },
      {
        skill: conditions._id, title: 'Grade Calculator', type: 'code', difficulty: 'medium', points: 20,
        description: 'Read a score (0-100) and print the grade:\n- 90-100: A\n- 80-89: B\n- 70-79: C\n- 60-69: D\n- Below 60: F',
        starterCode: '# Calculate grade from score\n',
        language: 'python', order: 2,
        testCases: [
          { input: '95', expectedOutput: 'A', isHidden: false },
          { input: '85', expectedOutput: 'B', isHidden: false },
          { input: '42', expectedOutput: 'F', isHidden: true }
        ],
        hints: ['Use if/elif/else to check ranges.', 'Start from the highest grade and work down.', 'Check if score >= 90 first, then >= 80, etc.'],
        solution: 'score = int(input())\nif score >= 90:\n    print("A")\nelif score >= 80:\n    print("B")\nelif score >= 70:\n    print("C")\nelif score >= 60:\n    print("D")\nelse:\n    print("F")'
      }
    ]);

    // Loops Tasks
    await Task.insertMany([
      {
        skill: loops._id, title: 'Count to N', type: 'code', difficulty: 'easy', points: 10,
        description: 'Read a positive integer N and print all numbers from 1 to N, each on a new line.',
        starterCode: '# Print numbers from 1 to N\n',
        language: 'python', order: 1,
        testCases: [
          { input: '5', expectedOutput: '1\n2\n3\n4\n5', isHidden: false },
          { input: '3', expectedOutput: '1\n2\n3', isHidden: true }
        ],
        hints: ['Use a for loop with range().', 'range(1, n+1) gives numbers from 1 to n.', 'for i in range(1, n+1):\n    print(i)'],
        solution: 'n = int(input())\nfor i in range(1, n+1):\n    print(i)'
      },
      {
        skill: loops._id, title: 'Sum of N Numbers', type: 'code', difficulty: 'medium', points: 20,
        description: 'Read N, then read N integers and print their sum.',
        starterCode: '# Read N numbers and print their sum\n',
        language: 'python', order: 2,
        testCases: [
          { input: '3\n1\n2\n3', expectedOutput: '6', isHidden: false },
          { input: '4\n10\n20\n30\n40', expectedOutput: '100', isHidden: true }
        ],
        hints: ['First read N, then use a loop to read N numbers.', 'Keep a running total by adding each number to a sum variable.', 'Initialize sum = 0 before the loop.'],
        solution: 'n = int(input())\ntotal = 0\nfor i in range(n):\n    total += int(input())\nprint(total)'
      },
      {
        skill: loops._id, title: 'Multiplication Table', type: 'code', difficulty: 'hard', points: 30,
        description: 'Read a number N and print its multiplication table from 1 to 10.\nFormat: N x i = result',
        starterCode: '# Print multiplication table\n',
        language: 'python', order: 3,
        testCases: [
          { input: '5', expectedOutput: '5 x 1 = 5\n5 x 2 = 10\n5 x 3 = 15\n5 x 4 = 20\n5 x 5 = 25\n5 x 6 = 30\n5 x 7 = 35\n5 x 8 = 40\n5 x 9 = 45\n5 x 10 = 50', isHidden: false }
        ],
        hints: ['Loop from 1 to 10 and compute n * i each time.', 'Use f-string formatting: f"{n} x {i} = {n*i}"', 'for i in range(1, 11):\n    print(f"{n} x {i} = {n*i}")'],
        solution: 'n = int(input())\nfor i in range(1, 11):\n    print(f"{n} x {i} = {n*i}")'
      }
    ]);

    // Functions Tasks
    await Task.insertMany([
      {
        skill: functions._id, title: 'Max of Three', type: 'code', difficulty: 'medium', points: 20,
        description: 'Write a function `max_of_three(a, b, c)` that returns the maximum of three numbers. Read three integers and print the result of calling your function.',
        starterCode: 'def max_of_three(a, b, c):\n    # Your code here\n    pass\n\na = int(input())\nb = int(input())\nc = int(input())\nprint(max_of_three(a, b, c))\n',
        language: 'python', order: 1,
        testCases: [
          { input: '1\n2\n3', expectedOutput: '3', isHidden: false },
          { input: '10\n5\n8', expectedOutput: '10', isHidden: false },
          { input: '-1\n-5\n-2', expectedOutput: '-1', isHidden: true }
        ],
        hints: ['Compare a with b first, then compare the larger with c.', 'You can use Python\'s built-in max() function or write your own logic.', 'return max(a, b, c) or use nested if/else.'],
        solution: 'def max_of_three(a, b, c):\n    return max(a, b, c)\n\na = int(input())\nb = int(input())\nc = int(input())\nprint(max_of_three(a, b, c))'
      }
    ]);

    // Arrays Tasks
    await Task.insertMany([
      {
        skill: arrays._id, title: 'Find the Maximum', type: 'code', difficulty: 'medium', points: 20,
        description: 'Read N numbers into a list and print the maximum value.',
        starterCode: '# Find the maximum in a list\n',
        language: 'python', order: 1,
        testCases: [
          { input: '5\n3 1 4 1 5', expectedOutput: '5', isHidden: false },
          { input: '3\n-1 -5 -2', expectedOutput: '-1', isHidden: true }
        ],
        hints: ['Read the numbers into a list using split().', 'You can use max() or loop through to find the largest.', 'nums = list(map(int, input().split()))'],
        solution: 'n = int(input())\nnums = list(map(int, input().split()))\nprint(max(nums))'
      },
      {
        skill: arrays._id, title: 'Reverse a List', type: 'code', difficulty: 'medium', points: 20,
        description: 'Read N numbers and print them in reverse order, space-separated.',
        starterCode: '# Reverse a list of numbers\n',
        language: 'python', order: 2,
        testCases: [
          { input: '5\n1 2 3 4 5', expectedOutput: '5 4 3 2 1', isHidden: false },
          { input: '3\n10 20 30', expectedOutput: '30 20 10', isHidden: true }
        ],
        hints: ['Read the list, then reverse it.', 'Use slicing [::-1] or the reverse() method.', 'print(" ".join(map(str, nums[::-1])))'],
        solution: 'n = int(input())\nnums = list(map(int, input().split()))\nprint(" ".join(map(str, nums[::-1])))'
      }
    ]);

    // =================== MATH TASKS ===================
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
        description: 'Simplify: **3(x + 2) - 2(x - 1)**\n\nWhat is the simplified form?\n\nOptions:\n- A) x + 8\n- B) x + 4\n- C) 5x + 4\n- D) x + 6',
        mathType: 'multiple-choice', mathOptions: ['x + 8', 'x + 4', '5x + 4', 'x + 6'],
        mathAnswer: 'x + 8', order: 2,
        hints: ['Distribute the 3 and -2.', '3x + 6 - 2x + 2 = ?', 'Combine like terms: (3x - 2x) + (6 + 2)'],
        solution: 'x + 8', explanation: '3(x+2) - 2(x-1) = 3x + 6 - 2x + 2 = x + 8'
      },
      {
        skill: geometry._id, title: 'Area of Triangle', type: 'math', difficulty: 'easy', points: 10,
        description: 'A triangle has a base of **10 cm** and a height of **6 cm**.\n\nWhat is its area in cm²?',
        mathType: 'numeric', mathAnswer: '30', order: 1,
        hints: ['The formula for triangle area is (base × height) / 2.', 'Plug in: (10 × 6) / 2', '60 / 2 = ?'],
        solution: '30', explanation: 'Area = (10 × 6) / 2 = 30 cm²'
      },
      {
        skill: geometry._id, title: 'Circle Circumference', type: 'math', difficulty: 'medium', points: 20,
        description: 'A circle has a radius of **7 cm**. What is its circumference?\n\nUse π = 3.14. Round to 2 decimal places.\n\nOptions:\n- A) 43.96\n- B) 21.98\n- C) 153.86\n- D) 44.00',
        mathType: 'multiple-choice', mathOptions: ['43.96', '21.98', '153.86', '44.00'],
        mathAnswer: '43.96', order: 2,
        hints: ['Circumference = 2πr', '2 × 3.14 × 7 = ?', 'Calculate: 6.28 × 7'],
        solution: '43.96', explanation: 'C = 2πr = 2 × 3.14 × 7 = 43.96 cm'
      },
      {
        skill: logic._id, title: 'Truth Table AND', type: 'math', difficulty: 'medium', points: 20,
        description: 'In a truth table for A AND B, how many rows result in TRUE?\n\nA and B can each be TRUE or FALSE.',
        mathType: 'numeric', mathAnswer: '1', order: 1,
        hints: ['List all combinations of A and B.', 'AND is true only when both inputs are true.', 'FF=F, FT=F, TF=F, TT=T → only 1 is true.'],
        solution: '1', explanation: 'A AND B is TRUE only when both A=TRUE and B=TRUE.'
      }
    ]);

    // Update skill totalTasks counts
    for (const skill of [variables, conditions, loops, functions, arrays, algebra, geometry, logic]) {
      const count = await Task.countDocuments({ skill: skill._id });
      await Skill.findByIdAndUpdate(skill._id, { totalTasks: count });
    }

    console.log('✅ Database seeded successfully!');
    console.log('   Admin: admin@wesolve.com / admin123');
    console.log('   Student: ahmed@student.com / student123');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
