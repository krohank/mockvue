import { DIFFICULTIES, QUESTION_TYPES } from '../../config/constants.js';

export const cleanAndParseJSON = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('AI output is empty or not a string');
  }

  let cleaned = rawText.trim();

  // Strip markdown code fences (```json ... ```)
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence && fence[1]) cleaned = fence[1].trim();

  const tryParse = (text) => JSON.parse(text.replace(/,\s*([}\]])/g, '$1'));

  try {
    return tryParse(cleaned);
  } catch (initialErr) {
    // Fall back to the outermost object or array in the text.
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    const candidates = [];
    if (firstObj !== -1) candidates.push(cleaned.slice(firstObj, cleaned.lastIndexOf('}') + 1));
    if (firstArr !== -1) candidates.push(cleaned.slice(firstArr, cleaned.lastIndexOf(']') + 1));
    candidates.sort((a, b) => b.length - a.length);

    for (const candidate of candidates) {
      try {
        return tryParse(candidate);
      } catch {
        // try next
      }
    }
    throw new Error(`Malformed AI JSON: ${initialErr.message}. Preview: ${cleaned.slice(0, 150)}...`);
  }
};

const stringList = (value, max) =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()).slice(0, max) : [];

export const validateQuestionsSchema = (data) => {
  const list = Array.isArray(data) ? data : data?.questions;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Invalid question output: expected a non-empty array of questions.');
  }

  const seen = new Set();
  const questions = [];
  for (const q of list) {
    const text = typeof q?.questionText === 'string' ? q.questionText.trim() : '';
    if (text.length < 15 || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());

    const criteria = stringList(q.evaluationCriteria, 6);
    questions.push({
      orderIndex: questions.length,
      questionText: text.slice(0, 1000),
      topic: typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim().slice(0, 80) : 'General',
      difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : 'Medium',
      type: QUESTION_TYPES.includes(q.type) ? q.type : 'Technical',
      referenceConcepts: stringList(q.referenceConcepts, 8),
      evaluationCriteria: criteria.length
        ? criteria
        : ['Accuracy of the core explanation', 'Depth and correct terminology', 'Handling of edge cases and trade-offs'],
    });
  }

  if (questions.length === 0) {
    throw new Error('Invalid question output: no usable questions.');
  }
  return questions;
};
