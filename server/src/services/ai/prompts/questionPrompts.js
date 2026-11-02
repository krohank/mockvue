const TYPE_GUIDANCE = {
  Technical: 'All questions are technical and test conceptual depth, trade-offs, and practical reasoning.',
  HR: 'All questions are HR-style: motivation, priorities, teamwork, and professional conduct.',
  Behavioral: 'All questions are behavioral and should be answerable with the STAR method (Situation, Task, Action, Result).',
  Mixed: 'Roughly four in five questions are technical; the rest are behavioral (STAR-style).',
};

export const buildQuestionGenerationPrompt = ({
  targetRole,
  topics,
  difficulty,
  interviewType,
  experienceLevel,
  questionCount,
}) => {
  const topicsStr = Array.isArray(topics) && topics.length > 0 ? topics.join(', ') : 'Core Computer Science';

  return `
You are a senior engineering interviewer preparing a realistic mock interview.

CANDIDATE PROFILE
- Target role: ${targetRole}
- Experience level: ${experienceLevel}
- Difficulty: ${difficulty}
- Interview type: ${interviewType} — ${TYPE_GUIDANCE[interviewType] || TYPE_GUIDANCE.Technical}
- Topics (spread questions across these): ${topicsStr}

TASK
Write exactly ${questionCount} distinct interview questions that could be asked in a real ${difficulty.toLowerCase()} round.
Avoid trivia and yes/no questions. Prefer "explain", "compare", "design", "how would you" questions that reveal reasoning.

For every question provide:
- "questionText": the question as the interviewer would say it (1–3 sentences).
- "topic": one of [${topicsStr}${interviewType !== 'Technical' ? ', HR & Behavioral' : ''}].
- "difficulty": "${difficulty}".
- "type": "Technical", "HR", or "Behavioral".
- "referenceConcepts": 3–5 short concepts a strong answer must mention.
- "evaluationCriteria": exactly 3 criteria used to grade the answer.

OUTPUT
Return ONLY a JSON object of the form {"questions": [ ... ]} with no markdown and no commentary.
`.trim();
};
