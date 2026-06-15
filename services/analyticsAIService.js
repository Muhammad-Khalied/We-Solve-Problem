const axios = require('axios');

/**
 * Analytics AI Service
 * Uses a SEPARATE Groq API key (ANALYTICS_GROQ_API_KEY) from a different account.
 * This ensures analytics AI calls never compete with the student chat tutor for rate limits.
 */

const PROMPT_VERSION = 'v1.0';

/**
 * Call Groq API with the analytics key.
 */
const callGroqAnalytics = async (systemPrompt, userMessage) => {
  const apiKey = process.env.ANALYTICS_GROQ_API_KEY;

  if (!apiKey || apiKey === 'your_analytics_groq_api_key') {
    console.warn('ANALYTICS_GROQ_API_KEY not set — returning mock analytics.');
    return null;
  }

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 2000
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Analytics Groq API Error:', error.response ? JSON.stringify(error.response.data) : error.message);
    return null;
  }
};

/**
 * Parse JSON from AI response. AI sometimes wraps JSON in markdown code blocks.
 */
const parseAIJson = (text) => {
  if (!text) return null;
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
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

// ============================================================
// 1. CHAT ANALYSIS
// ============================================================

/**
 * Analyze a student's conversation with the AI tutor.
 * Returns scores for understanding, dependency, critical thinking, confidence.
 */
exports.analyzeChatConversation = async (problem, conversation, studentCode, hintHistory) => {
  const systemPrompt = `You are an educational analytics AI. Analyze a student's conversation with an AI tutor to assess their learning process.

You must return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "understanding_score": <0-100>,
  "dependency_on_ai": <0-100>,
  "critical_thinking": <0-100>,
  "confidence_level": <0-100>,
  "summary": "<2-3 sentence summary of the student's learning process>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "recommendations": ["<recommendation 1>", "<recommendation 2>"]
}

Scoring guidelines:
- understanding_score: How well does the student understand the problem? (100 = perfect understanding)
- dependency_on_ai: How much did they rely on AI help? (100 = completely dependent, 0 = independent)
- critical_thinking: Did they ask thoughtful questions and reason through the problem? (100 = excellent)
- confidence_level: How confident was the student in their approach? (100 = very confident)

Consider:
- Number and nature of hints used
- Quality of student questions (vague vs specific)
- Whether student attempted before asking for help
- Whether student built on AI guidance or just asked for more help`;

  const userMessage = `PROBLEM:
${problem.title} (${problem.difficulty})
${problem.description}

HINT HISTORY:
${hintHistory.length > 0 ? hintHistory.map((h, i) => `Hint ${i + 1}: ${h}`).join('\n') : 'No hints used'}

CONVERSATION:
${conversation.length > 0 ? conversation.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') : 'No conversation'}

STUDENT CODE:
${studentCode || 'No code submitted'}`;

  const response = await callGroqAnalytics(systemPrompt, userMessage);
  const parsed = parseAIJson(response);

  if (parsed) return parsed;

  // Fallback mock response
  return {
    understanding_score: 70,
    dependency_on_ai: 40,
    critical_thinking: 65,
    confidence_level: 60,
    summary: 'Analysis unavailable — AI service returned no data. This is a placeholder.',
    strengths: ['Attempted the problem'],
    weaknesses: ['Analysis data unavailable'],
    recommendations: ['Continue practicing']
  };
};

// ============================================================
// 2. EIGHT-SKILL EVALUATION
// ============================================================

/**
 * Evaluate a student's solution against the 8 problem-solving skills.
 */
exports.evaluateStudentSkills = async (problem, studentCode, chatHistory, hintHistory, events) => {
  const systemPrompt = `You are an educational assessment AI. Evaluate a student's problem-solving skills based on their work.

You must return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "overall_score": <0-100>,
  "skills": [
    {
      "name": "Problem Understanding",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    },
    {
      "name": "Problem Analysis",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    },
    {
      "name": "Decomposition",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    },
    {
      "name": "Initial Solution",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    },
    {
      "name": "Debugging Ability",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    },
    {
      "name": "Creativity",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    },
    {
      "name": "Optimization",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    },
    {
      "name": "Systematic Methodology",
      "score": <0-100>,
      "strengths": ["..."],
      "weaknesses": ["..."],
      "feedback": "<1-2 sentences>"
    }
  ],
  "summary": "<3-4 sentence overall assessment>",
  "next_steps": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]
}

Skill definitions:
1. Problem Understanding: Did the student understand the goal and expected outputs?
2. Problem Analysis: Did they identify inputs, outputs, variables, and constraints?
3. Decomposition: Did they break the problem into sub-problems?
4. Initial Solution: Was the first approach correct and logical?
5. Debugging Ability: Could they detect and fix errors? Did they learn from failures?
6. Creativity: Did they try innovative or alternative approaches?
7. Optimization: Code quality, efficiency, and refactoring?
8. Systematic Methodology: Did they follow Analysis → Design → Implementation → Testing?

Use the event log to understand the student's process (attempts, errors, runs).
Be fair but constructive. This is for secondary school students.`;

  // Build event summary for the prompt
  const eventSummary = {};
  events.forEach(e => {
    eventSummary[e.type] = (eventSummary[e.type] || 0) + 1;
  });

  const userMessage = `PROBLEM:
${problem.title} (${problem.difficulty}, ${problem.points} points)
Type: ${problem.type}
${problem.description}

STUDENT CODE:
${studentCode || 'No code submitted'}

HINT HISTORY:
${hintHistory.length > 0 ? hintHistory.map((h, i) => `Hint ${i + 1}: ${h}`).join('\n') : 'No hints used'}

CHAT HISTORY:
${chatHistory.length > 0 ? chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n') : 'No chat messages'}

EVENT LOG SUMMARY:
${Object.entries(eventSummary).map(([type, count]) => `- ${type}: ${count} times`).join('\n') || 'No events recorded'}

DETAILED EVENTS (chronological):
${events.slice(0, 30).map(e => `[${new Date(e.createdAt).toISOString()}] ${e.type}: ${JSON.stringify(e.metadata)}`).join('\n') || 'No events'}`;

  const response = await callGroqAnalytics(systemPrompt, userMessage);
  const parsed = parseAIJson(response);

  if (parsed) return parsed;

  // Fallback mock
  return {
    overall_score: 65,
    skills: [
      { name: 'Problem Understanding', score: 70, strengths: ['Attempted the problem'], weaknesses: ['Analysis unavailable'], feedback: 'AI analysis unavailable.' },
      { name: 'Problem Analysis', score: 65, strengths: [], weaknesses: [], feedback: 'AI analysis unavailable.' },
      { name: 'Decomposition', score: 60, strengths: [], weaknesses: [], feedback: 'AI analysis unavailable.' },
      { name: 'Initial Solution', score: 70, strengths: [], weaknesses: [], feedback: 'AI analysis unavailable.' },
      { name: 'Debugging Ability', score: 60, strengths: [], weaknesses: [], feedback: 'AI analysis unavailable.' },
      { name: 'Creativity', score: 55, strengths: [], weaknesses: [], feedback: 'AI analysis unavailable.' },
      { name: 'Optimization', score: 60, strengths: [], weaknesses: [], feedback: 'AI analysis unavailable.' },
      { name: 'Systematic Methodology', score: 65, strengths: [], weaknesses: [], feedback: 'AI analysis unavailable.' }
    ],
    summary: 'AI analysis unavailable — please set ANALYTICS_GROQ_API_KEY in .env.',
    next_steps: ['Configure analytics API key to enable AI-powered evaluation']
  };
};

// ============================================================
// 3. FEEDBACK GENERATOR
// ============================================================

/**
 * Generate personalized feedback for a student after solving a problem.
 */
exports.generateFeedback = async (problem, studentCode, chatHistory, skillEvaluation) => {
  const systemPrompt = `You are an educational feedback AI. Generate personalized, encouraging feedback for a secondary school student.

You must return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "feedback_markdown": "<markdown formatted feedback with ## headers, bullet points, and emoji>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<area for improvement 1>", "<area for improvement 2>"],
  "recommended_topics": ["<topic 1>", "<topic 2>"],
  "next_problems": ["<problem suggestion 1>", "<problem suggestion 2>"]
}

Guidelines:
- Be encouraging and constructive
- Use simple language for secondary school students
- The feedback_markdown should be 3-5 paragraphs with emoji
- Include specific achievements (what they did well)
- Frame weaknesses as "areas to improve" not failures
- Suggest concrete next steps`;

  const skillSummary = skillEvaluation.skills
    ? skillEvaluation.skills.map(s => `${s.name}: ${s.score}/100`).join(', ')
    : 'No skill data';

  const userMessage = `PROBLEM:
${problem.title} (${problem.difficulty})
${problem.description}

STUDENT CODE:
${studentCode || 'No code submitted'}

SKILL EVALUATION:
Overall: ${skillEvaluation.overall_score}/100
Skills: ${skillSummary}

CHAT HISTORY (summary):
${chatHistory.length} messages exchanged with AI tutor

ASSESSMENT SUMMARY:
${skillEvaluation.summary || 'No summary available'}`;

  const response = await callGroqAnalytics(systemPrompt, userMessage);
  const parsed = parseAIJson(response);

  if (parsed) return parsed;

  // Fallback
  return {
    feedback_markdown: '## 📊 Analysis Pending\n\nAI feedback is not available at the moment. Please ensure the analytics API key is configured.',
    strengths: ['Attempted the problem'],
    weaknesses: ['Analysis not available'],
    recommended_topics: ['Continue with current skill path'],
    next_problems: ['Try the next problem in the roadmap']
  };
};

/**
 * Get the current prompt version for audit tracking.
 */
exports.PROMPT_VERSION = PROMPT_VERSION;
