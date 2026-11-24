import Answer from '../models/Answer.js';
import Question from '../models/Question.js';
import Interview from '../models/Interview.js';
import { aiService } from './ai/AIProviderFactory.js';
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
