export const hasScoredRubric = (answer) => !answer.skipped && !answer.isFallbackEvaluation &&
  !['pending', 'processing'].includes(answer.evaluationStatus) && Number.isFinite(answer.overallScore) &&
  (answer.evaluationProvider === 'local' || (answer.evaluationProvider === 'rules' && answer.evaluationKind === 'rule-based' && Boolean(answer.rubricVersion)));

export function summarizeScore(answers, questionCount) {
  if (answers.some((a) => ['pending', 'processing'].includes(a.evaluationStatus))) return { scoreStatus: 'pending', overallScore: null };
  // Earlier keyword-based scores are not evidence of answer correctness either.
  if (answers.some((a) => !a.skipped && !hasScoredRubric(a))) return { scoreStatus: 'ungraded', overallScore: null };
  if (new Set(answers.filter(hasScoredRubric).map((a) => a.evaluationProvider)).size > 1) return { scoreStatus: 'ungraded', overallScore: null };
  return { scoreStatus: 'graded', overallScore: Math.round(answers.reduce((sum, a) => sum + (a.skipped ? 0 : a.overallScore), 0) / Math.max(1, questionCount)) };
}
