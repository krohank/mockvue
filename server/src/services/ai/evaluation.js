export function normalizeEvaluation(data) {
  if (data?.isFallback && data.evaluationKind === 'concept-check') return { ...data, overallScore: null, correctConcepts: [] };
  if (!data || !data.criteriaScores) throw new Error('AI returned an incomplete score breakdown.');
  const maxes = { technicalCorrectness: 40, relevance: 20, completeness: 20, clarity: 20 };
  const scores = {};
  for (const [key, max] of Object.entries(maxes)) {
    const value = data.criteriaScores[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('AI returned an invalid score.');
    scores[key] = Math.round(Math.min(max, Math.max(0, value)));
  }
  const result = { ...data, criteriaScores: scores, overallScore: Object.values(scores).reduce((sum, n) => sum + n, 0) };
  for (const key of ['correctConcepts', 'missingConcepts', 'mistakes', 'recommendedTopics']) {
    result[key] = Array.isArray(data[key]) ? data[key].filter((v) => typeof v === 'string').slice(0, 12) : [];
  }
  for (const key of ['explanation', 'feedback', 'improvedAnswer']) {
    result[key] = typeof data[key] === 'string' ? data[key].slice(0, 10000) : '';
  }
  return result;
}
