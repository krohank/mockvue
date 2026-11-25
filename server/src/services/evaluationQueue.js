import Answer from '../models/Answer.js';
import Question from '../models/Question.js';
import Interview from '../models/Interview.js';
import { aiService } from './ai/AIProviderFactory.js';
import { env } from '../config/env.js';
import { FallbackProvider } from './ai/FallbackProvider.js';
import { normalizeEvaluation } from './ai/evaluation.js';
import { finalize, isFinished, withInterviewLock } from './interviewState.js';

let timer, running = null, stopping = false;
const fallback = new FallbackProvider();
async function drain() {
  while (!stopping) {
    // The lease recovers interrupted work after a server restart. Local requests
    // have a 120s maximum timeout; no two workers claim an active lease.
    const answer = await Answer.findOneAndUpdate({ $or: [
      { evaluationStatus: 'pending' },
      { evaluationStatus: 'processing', gradingStartedAt: { $lt: new Date(Date.now() - 180000) } },
    ] }, { $set: { evaluationStatus: 'processing', gradingStartedAt: new Date() }, $inc: { gradingAttempts: 1 } }, { new: true, sort: { submittedAt: 1 } });
    if (!answer) return;
    const question = await Question.findById(answer.questionId);
    const input = { questionText: question?.questionText || '', bankId: question?.bankId, referenceAnswer: question?.referenceAnswer,
      referenceConcepts: question?.referenceConcepts || [], evaluationCriteria: question?.evaluationCriteria || [],
      followUpQuestions: question?.followUpQuestions, answerSource: question?.answerSource,
      candidateAnswer: answer.responseText, topic: question?.topic, type: question?.type };
    let evaluation;
    try { evaluation = normalizeEvaluation(await (answer.gradingAttempts > 2 ? fallback : aiService).evaluateAnswer(input)); }
    catch (error) { console.warn('[Grading] Using study guide:', error.message); evaluation = await fallback.evaluateAnswer(input); }
    await Answer.updateOne({ _id: answer._id }, { $set: { ...evaluation, evaluationStatus: 'completed',
      evaluationProvider: evaluation.isFallback ? 'fallback' : evaluation.provider || null,
      evaluationModel: evaluation.model || null, isFallbackEvaluation: Boolean(evaluation.isFallback) } });
    await withInterviewLock(String(answer.interviewId), async () => {
      const interview = await Interview.findById(answer.interviewId);
      if (interview && isFinished(interview)) await finalize(interview);
    });
  }
}
// Answers saved while no scorer was running (an unavailable model, or the old
// checklist-only mode) are re-scored by the local rubric checker at startup, so a
// session finished earlier gets its score without being repeated. Scores that a
// language model already produced are left alone.
export async function requeueUngradedAnswers() {
  if (env.AI_PROVIDER !== 'rules') return 0;
  const result = await Answer.updateMany({
    skipped: { $ne: true }, evaluationStatus: 'completed', responseText: { $nin: ['', '[Skipped]'] },
    $and: [
      { $or: [{ evaluationProvider: { $ne: 'rules' } }, { evaluationKind: { $ne: 'rule-based' } }, { rubricVersion: null }] },
      { $nor: [{ evaluationProvider: 'local', overallScore: { $ne: null } }] },
    ],
  }, { $set: { evaluationStatus: 'pending', gradingStartedAt: null, gradingAttempts: 0, overallScore: null,
    feedback: 'Answer saved. It is being scored with the local rubric checker.' } });
  return result.modifiedCount;
}
export function wakeEvaluationWorker() {
  if (stopping || running) return running;
  running = drain().catch((error) => console.error('[Grading] Queue will retry:', error.message)).finally(() => { running = null; });
  return running;
}
export function startEvaluationWorker() {
  stopping = false;
  if (!timer) { timer = setInterval(wakeEvaluationWorker, 2000); timer.unref(); }
  wakeEvaluationWorker();
}
export async function stopEvaluationWorker() {
  stopping = true; clearInterval(timer); timer = null;
  await running;
}
