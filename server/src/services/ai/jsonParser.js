export const cleanAndParseJSON = (rawText) => {
  if (!rawText || typeof rawText !== 'string') throw new Error('AI output is empty or not a string.');
  const cleaned = rawText.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1');
  try { return JSON.parse(cleaned); } catch { /* Try a JSON value surrounded by prose. */ }
  const start = cleaned.search(/[\[{]/);
  if (start >= 0) {
    const stack = []; let quoted = false, escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
        continue;
      }
      if (c === '"') quoted = true;
      else if (c === '{' || c === '[') stack.push(c);
      else if (c === '}' || c === ']') {
        if (stack.pop() !== (c === '}' ? '{' : '[')) break;
        if (!stack.length) {
          try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  throw new Error('Local AI returned malformed JSON.');
};

export const validateQuestionsSchema = (data) => {
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Invalid question output: Expected a non-empty array of questions.');
  }

  return list.map((q, idx) => {
    if (!q.questionText || typeof q.questionText !== 'string') {
      throw new Error(`Question at index ${idx} is missing questionText.`);
    }

    return {
      orderIndex: idx,
      questionText: q.questionText.trim(),
      topic: q.topic || 'General Technical',
      difficulty: ['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium',
      type: ['Technical', 'HR', 'Behavioral'].includes(q.type) ? q.type : 'Technical',
      referenceConcepts: Array.isArray(q.referenceConcepts) ? q.referenceConcepts : [],
      referenceAnswer: q.referenceAnswer || '',
      answerSource: 'local-model',
      followUpQuestions: Array.isArray(q.followUpQuestions) ? q.followUpQuestions : [],
      evaluationCriteria: Array.isArray(q.evaluationCriteria) ? q.evaluationCriteria : [
        'Accuracy of core explanation',
        'Technical depth and terminology',
        'Handling of edge cases or trade-offs',
      ],
    };
  });
};
