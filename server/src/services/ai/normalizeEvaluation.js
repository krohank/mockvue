/**
 * LLM output is untrusted: scores can exceed their maxima, be strings, or not
 * add up. This normalizes any provider's evaluation into the exact shape the
 * Answer model expects. The overall score is always recomputed from criteria.
 */
export const CRITERIA_MAX = {
  technicalCorrectness: 40,
  relevance: 20,
  completeness: 20,
  clarity: 20,
};

const toInt = (value, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.round(n)));
};

const toStringList = (value, { maxItems = 8, maxLength = 240 } = {}) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim().slice(0, maxLength))
    .slice(0, maxItems);
};

const toText = (value, maxLength = 2000) => (typeof value === 'string' ? value.trim().slice(0, maxLength) : '');

export const normalizeEvaluation = (raw, { provider = 'unknown', isFallback = false } = {}) => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Evaluation output is not an object.');
  }

  const source = raw.criteriaScores && typeof raw.criteriaScores === 'object' ? raw.criteriaScores : raw;
  const criteriaScores = Object.fromEntries(
    Object.entries(CRITERIA_MAX).map(([key, max]) => [key, toInt(source[key], max)])
  );

  const hasAnyCriterion = Object.keys(CRITERIA_MAX).some((k) => source[k] !== undefined);
  if (!hasAnyCriterion) {
    throw new Error('Evaluation output is missing criteria scores.');
  }

  const overallScore = Object.values(criteriaScores).reduce((a, b) => a + b, 0);

  return {
    overallScore,
    criteriaScores,
    correctConcepts: toStringList(raw.correctConcepts),
    missingConcepts: toStringList(raw.missingConcepts),
    mistakes: toStringList(raw.mistakes, { maxItems: 6, maxLength: 300 }),
    explanation: toText(raw.explanation, 1000),
    feedback: toText(raw.feedback, 1500),
    improvedAnswer: toText(raw.improvedAnswer, 3000),
    recommendedTopics: toStringList(raw.recommendedTopics, { maxItems: 5, maxLength: 80 }),
    isFallback,
    provider,
  };
};
