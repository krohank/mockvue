export function summarizeScore(answers, questionCount) {
  if (answers.some((a) => ['pending', 'processing'].includes(a.evaluationStatus))) return { scoreStatus: 'pending', overallScore: null };
  // Earlier keyword-based scores are not evidence of answer correctness either.
  if (answers.some((a) => !a.skipped && (a.isFallbackEvaluation || a.evaluationProvider !== 'local' || a.evaluationKind === 'concept-check' || typeof a.overallScore !== 'number'))) return { scoreStatus: 'ungraded', overallScore: null };
  return { scoreStatus: 'graded', overallScore: Math.round(answers.reduce((sum, a) => sum + (a.skipped ? 0 : a.overallScore), 0) / Math.max(1, questionCount)) };
}
