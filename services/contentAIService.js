const axios = require('axios');

/**
 * Content Generator AI Service
 * Uses a SEPARATE Groq API key (CONTENT_GROQ_API_KEY) from a third account.
 * Generates skills and tasks from educational material provided by the teacher.
 */

/**
 * Call Groq API with the content generator key.
 */
const callGroqContent = async (systemPrompt, userMessage) => {
  const apiKey = process.env.CONTENT_GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_content_groq_api_key') {
    console.warn('CONTENT_GROQ_API_KEY not set — returning mock content.');
    return null;
  }

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 4000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Content Groq API Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return null;
  }
};

/**
 * Parse JSON from AI response. AI sometimes wraps JSON in markdown code blocks.
 */
const parseAIJson = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
};

/**
 * Generate skills and tasks from educational material.
 * This is a conversational function — it accepts the full chat history.
 */
exports.generateContent = async (messages) => {
  const systemPrompt = `You are an expert educational content creator for a programming and math learning platform called "WE Solve Problems". 
  
Your job is to help teachers create skills and tasks from educational material they provide (syllabus, textbook content, curriculum goals, etc.).

IMPORTANT RULES:
- When the teacher provides material, generate STRUCTURED content (skills and tasks)
- Each skill belongs to a subject and has tasks under it
- Tasks can be type "code" (programming) or "math"
- Code tasks MUST include: title, description, difficulty, points, language, starterCode, testCases (with input/expectedOutput), hints (3 levels), solution, explanation
- Math tasks MUST include: title, description, difficulty, points, mathAnswer, mathOptions (for multiple choice), hints (3 levels), solution, explanation
- Test cases should cover edge cases too
- Hints must be progressive: hint 1 = gentle nudge, hint 2 = more specific, hint 3 = almost reveals the approach
- Points: easy=10, medium=20, hard=30
- Always respond with valid JSON when generating content

When you generate content, respond with ONLY valid JSON in this format:
{
  "message": "<A friendly message explaining what you generated>",
  "skills": [
    {
      "name": "Skill Name",
      "description": "Description of the skill",
      "icon": "🎯",
      "difficulty": "beginner|intermediate|advanced",
      "tasks": [
        {
          "title": "Task Title",
          "description": "Detailed problem description for the student",
          "type": "code",
          "difficulty": "easy|medium|hard",
          "points": 10,
          "language": "python",
          "starterCode": "# Write your code here\\n",
          "testCases": [
            { "input": "5", "expectedOutput": "25", "isHidden": false },
            { "input": "0", "expectedOutput": "0", "isHidden": true }
          ],
          "hints": [
            "Think about what operation squares a number",
            "Use the ** operator or multiply the number by itself",
            "The formula is: result = n * n or n ** 2"
          ],
          "solution": "n = int(input())\\nprint(n ** 2)",
          "explanation": "We read the number and compute its square using the ** operator."
        }
      ]
    }
  ]
}

For math tasks, use this format instead:
{
  "title": "Task Title",
  "description": "Math problem description",
  "type": "math",
  "difficulty": "easy",
  "points": 10,
  "mathAnswer": "42",
  "mathOptions": ["38", "40", "42", "44"],
  "hints": ["hint1", "hint2", "hint3"],
  "solution": "42",
  "explanation": "Step by step explanation..."
}

If the teacher asks a question or wants to refine the content, respond conversationally but still include the JSON structure when generating/modifying content.

If the teacher just wants to chat without generating, respond with:
{
  "message": "<your response>",
  "skills": []
}`;

  const apiKey = process.env.CONTENT_GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_content_groq_api_key') {
    return {
      message: '⚠️ Content Generator AI is not configured. Please add CONTENT_GROQ_API_KEY to your .env file.',
      skills: []
    };
  }

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 4000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    const text = response.data.choices[0].message.content;
    const parsed = parseAIJson(text);

    if (parsed) return parsed;

    // If not JSON, treat as conversational response
    return {
      message: text,
      skills: []
    };
  } catch (error) {
    console.error('Content Generator API Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return {
      message: '❌ AI service error. Please try again.',
      skills: []
    };
  }
};
