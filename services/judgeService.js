const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

// Judge0 language IDs
const LANGUAGE_IDS = {
  python: 71,     // Python 3
  javascript: 63, // Node.js
  cpp: 54         // C++ (GCC)
};

/**
 * Submit code to Judge0 for execution.
 * Returns the execution result.
 */
const executeCode = async (code, language, input = '') => {
  const apiUrl = process.env.JUDGE0_API_URL;
  const apiKey = process.env.JUDGE0_API_KEY;

  // Mock execution if no API key configured
  if (!apiKey || apiKey === 'your_judge0_api_key') {
    return getMockExecution(code, language, input);
  }

  try {
    // Create submission
    const createResponse = await axios.post(
      `${apiUrl}/submissions?base64_encoded=true&wait=true`,
      {
        source_code: Buffer.from(code).toString('base64'),
        language_id: LANGUAGE_IDS[language] || 71,
        stdin: Buffer.from(input).toString('base64'),
        cpu_time_limit: 5,
        memory_limit: 128000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com'
        }
      }
    );

    const result = createResponse.data;

    return {
      stdout: result.stdout ? Buffer.from(result.stdout, 'base64').toString() : '',
      stderr: result.stderr ? Buffer.from(result.stderr, 'base64').toString() : '',
      compile_output: result.compile_output ? Buffer.from(result.compile_output, 'base64').toString() : '',
      status: result.status,
      time: result.time,
      memory: result.memory
    };
  } catch (error) {
    console.error('Judge0 API Error:', error.message);
    throw new Error('Code execution service unavailable. Please try again.');
  }
};

/**
 * Run code against multiple test cases.
 */
const runTestCases = async (code, language, testCases) => {
  const results = [];

  for (const testCase of testCases) {
    try {
      const result = await executeCode(code, language, testCase.input);
      const actualOutput = (result.stdout || '').trim();
      const expectedOutput = (testCase.expectedOutput || '').trim();
      const passed = actualOutput === expectedOutput;

      results.push({
        passed,
        input: testCase.isHidden ? '[Hidden]' : testCase.input,
        expected: testCase.isHidden ? '[Hidden]' : expectedOutput,
        actual: testCase.isHidden && !passed ? '[Hidden]' : actualOutput,
        error: result.stderr || result.compile_output || ''
      });
    } catch (error) {
      results.push({
        passed: false,
        input: testCase.isHidden ? '[Hidden]' : testCase.input,
        expected: testCase.isHidden ? '[Hidden]' : testCase.expectedOutput,
        actual: '',
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Mock execution for development without Judge0 API key.
 * Simulates Python execution for simple programs.
 */
const getMockExecution = async (code, language, input) => {
  if (language !== 'python' && language !== 'javascript') {
    return {
      stdout: '',
      stderr: `Language "${language}" execution is not supported locally. Please configure a valid JUDGE0_API_KEY in your .env file.`,
      compile_output: '',
      status: { id: 11, description: 'Runtime Error' },
      time: '0.0',
      memory: 0
    };
  }

  const tempDir = path.join(__dirname, '../temp');
  // Ensure temp directory exists
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (err) {
    // ignore
  }

  const ext = language === 'python' ? 'py' : 'js';
  const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
  const filePath = path.join(tempDir, fileName);

  try {
    await fs.writeFile(filePath, code, 'utf8');

    const cmd = language === 'python' ? `python "${filePath}"` : `node "${filePath}"`;

    const result = await new Promise((resolve) => {
      const child = exec(cmd, { timeout: 3000 }, (error, stdout, stderr) => {
        if (error) {
          if (child.killed || error.killed) {
            resolve({
              stdout: stdout || '',
              stderr: 'Time Limit Exceeded (3 seconds limit)',
              statusId: 5,
              statusDesc: 'Time Limit Exceeded'
            });
          } else {
            resolve({
              stdout: stdout || '',
              stderr: stderr || error.message,
              statusId: 11,
              statusDesc: 'Runtime Error'
            });
          }
        } else {
          resolve({
            stdout: stdout || '',
            stderr: stderr || '',
            statusId: 3,
            statusDesc: 'Accepted'
          });
        }
      });

      // Write stdin inputs if any
      if (input) {
        child.stdin.write(input);
      }
      child.stdin.end();
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      compile_output: '',
      status: { id: result.statusId, description: result.statusDesc },
      time: '0.1',
      memory: 1024
    };
  } catch (err) {
    return {
      stdout: '',
      stderr: err.message,
      compile_output: '',
      status: { id: 11, description: 'Runtime Error' },
      time: '0.0',
      memory: 0
    };
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (e) {
      // ignore
    }
  }
};

module.exports = { executeCode, runTestCases, LANGUAGE_IDS };
