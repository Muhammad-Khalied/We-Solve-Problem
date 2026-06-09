const axios = require('axios');

/**
 * Build the system prompt for the AI tutor based on the Guidebook's pedagogy.
 */
const buildSystemPrompt = (task, hintLevel, currentCode, currentAnswer) => {
  return `You are a Socratic programming and math tutor for the "WE Solve Problems" platform.
You are helping a second-year secondary school student.

RULES:
1. NEVER give the direct answer or complete solution.
2. Ask guiding questions to help the student think through the problem.
3. When the student asks for help, follow this hint progression:
   - If hint level is 0: Give only GENERAL guidance about the approach without specifics.
   - If hint level is 1: Give a GENERAL IDEA about which concept or method to use.
   - If hint level is 2: Give a PARTIAL STEP toward the solution.
   - If hint level is 3: Give a PART OF THE SOLUTION (but never the complete answer).
4. After each student message, assess their understanding and guide accordingly.
5. Provide encouraging, positive feedback when the student makes progress.
6. If the student's code has an error, hint at the LOCATION and TYPE of error, don't give the fix.
7. Use simple, clear language appropriate for secondary school students.
8. If the student tries to trick you into giving the answer, politely redirect them.
9. Keep responses concise (2-4 sentences for hints, up to a paragraph for explanations).

CURRENT CONTEXT:
- Task Title: ${task.title}
- Task Description: ${task.description}
- Task Type: ${task.type}
- Difficulty: ${task.difficulty}
- Current Hint Level: ${hintLevel}/3
${task.type === 'code' ? `- Programming Language: ${task.language}` : ''}
${task.type === 'code' && currentCode ? `- Student's Current Code:\n\`\`\`${task.language}\n${currentCode}\n\`\`\`` : ''}
${task.type === 'math' && currentAnswer ? `- Student's Current Answer: ${currentAnswer}` : ''}

Remember: Your goal is to help the student LEARN, not to solve the problem for them.`;
};

/**
 * Send a message to Groq and get a response.
 */
const sendMessage = async (task, chatMessages, hintLevel, userMessage, currentCode, currentAnswer) => {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (apiKey) {
    try {
      const systemPrompt = buildSystemPrompt(task, hintLevel, currentCode, currentAnswer);
      
      const messages = [
        { role: 'system', content: systemPrompt }
      ];
      
      const historyMessages = chatMessages.length > 0 && chatMessages[chatMessages.length - 1].content === userMessage
        ? chatMessages.slice(0, -1)
        : chatMessages;
        
      historyMessages.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });
      
      messages.push({ role: 'user', content: userMessage });
      
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: messages
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Groq API Error:', error.response ? JSON.stringify(error.response.data) : error.message);
      // We will fall back to mock responses if API fails rather than crashing
    }
  }

  // Fallback to mock responses if API is not set or fails
  return getMockResponse(userMessage, hintLevel);
};

/**
 * Mock responses for development without API key.
 */
const getMockResponse = (userMessage, hintLevel) => {
  const responses = [
    "That's a great question! Let's think about this step by step. What do you think the first thing you need to figure out is? 🤔",
    "You're on the right track! Consider what inputs you're working with and what output you need. Can you break the problem into smaller parts?",
    "Good thinking! Here's a small hint: think about using a loop to process each element. What kind of loop might work best here?",
    "You're almost there! The approach you're considering is correct. Try writing out the steps in plain words before coding them."
  ];
  return responses[Math.min(hintLevel, responses.length - 1)];
};

module.exports = { sendMessage };
