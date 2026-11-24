import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import Interview from '../models/Interview.js';
import { aiService } from '../services/ai/AIProviderFactory.js';
import { findBankQuestion, SUPPORTED_TOPICS } from '../services/ai/QuestionCatalog.js';
import { wakeEvaluationWorker } from '../services/evaluationQueue.js';
import { summarizeScore } from '../services/scoreSummary.js';
import { ownedInterview, withInterviewLock, isFinished, assertActive, endsAt, finalize } from '../services/interviewState.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../utils/customErrors.js';
import mongoose from 'mongoose';

const safe = (handler) => async (req, res, next) => { try { await handler(req, res); } catch (e) { next(e); } };
const criteriaZero = { technicalCorrectness: 0, relevance: 0, completeness: 0, clarity: 0 };
const publicQuestion = (q, finished) => {
  const data = q.toObject();
  if (!finished) for (const field of ['referenceConcepts', 'evaluationCriteria', 'referenceAnswer', 'followUpQuestions', 'bankId', 'answerSource']) delete data[field];
  return data;
};
async function restoreProgress(interview) {
  const answers = await Answer.find({ interviewId: interview._id }).select('questionId');
  const answered = new Set(answers.map((a) => String(a.questionId)));
  const next = interview.questions.findIndex((q) => !answered.has(String(q)));
  interview.currentQuestionIndex = next < 0 ? interview.questions.length : next;
  return next;
}

async function createStoredAnswer(interview, question, { responseText = '', responseType = 'text', timeSpentSeconds = 0, skipped = false }) {
  const guide = findBankQuestion(question);
  const evaluation = skipped ? {
      overallScore: 0, criteriaScores: criteriaZero, correctConcepts: [], missingConcepts: question.referenceConcepts,
      feedback: 'You skipped this question. Review the key concepts, then try it again in another interview.',
      improvedAnswer: question.referenceAnswer || guide?.referenceAnswer || 'Review: ' + question.referenceConcepts.join('; '),
      followUpQuestions: question.followUpQuestions?.length ? question.followUpQuestions : guide?.followUpQuestions || [],
      answerSource: question.referenceAnswer ? question.answerSource : guide?.answerSource || 'outline',
      evaluationKind: 'skipped', evaluationStatus: 'completed', isFallback: true,
    } : { evaluationStatus: 'pending', overallScore: null, feedback: 'Answer saved. Feedback is being prepared; you can continue.' };
  const answer = await Answer.create({
      ...evaluation, interviewId: interview._id, questionId: question._id, userId: interview.userId,
      responseText: skipped ? '[Skipped]' : responseText.trim(), responseType, skipped,
      timeSpentSeconds: Math.max(0, Math.min(3600, Number(timeSpentSeconds) || 0)), isFallbackEvaluation: evaluation.isFallback || false,
      evaluationProvider: evaluation.isFallback ? 'fallback' : evaluation.provider || null, evaluationModel: evaluation.model || null,
    });
  if (!skipped) setImmediate(wakeEvaluationWorker);
  return answer;
}

export const generateInterview = safe(async (req, res) => {
  const { targetRole, topics: rawTopics, difficulty = 'Medium', interviewType = 'Technical', questionCount = 5, durationMinutes = 20, mode = 'practice' } = req.body;
  if (typeof targetRole !== 'string' || !targetRole.trim() || targetRole.length > 100) throw new ValidationError('Choose a valid target role.');
  if (!Array.isArray(rawTopics) || !rawTopics.length || rawTopics.length > 15 || rawTopics.some((t) => typeof t !== 'string' || !SUPPORTED_TOPICS.includes(t.trim()))) throw new ValidationError('Select at least one supported topic.');
  const topics = [...new Set(rawTopics.map((t) => t.trim()))];
  if (!['Easy', 'Medium', 'Hard'].includes(difficulty) || !['Technical', 'HR', 'Behavioral', 'Mixed'].includes(interviewType)) throw new ValidationError('Choose a valid difficulty and interview type.');
  if (!['practice', 'assessment'].includes(mode)) throw new ValidationError('Choose practice or assessment mode.');
  const count = Number(questionCount), duration = Number(durationMinutes);
  if (!Number.isInteger(count) || count < 1 || count > 10 || !Number.isInteger(duration) || duration < 5 || duration > 60) throw new ValidationError('Choose 1–10 questions and a 5–60 minute time limit.');
  const recentIds = (await Interview.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(5).select('_id').lean()).map((i) => i._id);
  const recent = await Question.find({ interviewId: { $in: recentIds } }).select('questionText');
  const result = await aiService.generateQuestions({ targetRole: targetRole.trim(), topics, difficulty, interviewType, experienceLevel: req.user.experienceLevel, questionCount: count, recentQuestionTexts: recent.map((q) => q.questionText) });
  if (!result.questions?.length) throw new ValidationError('No questions are available for this selection. Choose another topic.');
  const interview = await Interview.create({
    userId: req.user._id, title: difficulty + ' ' + interviewType + ' Interview — ' + targetRole.trim(),
    targetRole: targetRole.trim(), topics, difficulty, interviewType, durationMinutes: duration, mode, isFallbackAI: result.isFallback, generationNotice: result.message || null,
    questionProvider: result.provider,
  });
  try {
    const questions = await Question.insertMany(result.questions.map((q, index) => ({ ...q, _id: undefined, interviewId: interview._id, orderIndex: index })));
    interview.questions = questions.map((q) => q._id);
    await interview.save();
    res.status(201).json({ success: true, interviewId: interview._id, interview: { ...interview.toObject(), questionCount: questions.length }, notice: result.message || null });
  } catch (error) {
    await Question.deleteMany({ interviewId: interview._id });
    await Interview.deleteOne({ _id: interview._id });
    throw error;
  }
});
export const getInterview = safe(async (req, res) => withInterviewLock(req.params.id, async () => {
  const interview = await ownedInterview(req.params.id, req.user._id, true);
  const answers = await Answer.find({ interviewId: interview._id });
  const answered = new Set(answers.map((a) => String(a.questionId)));
  const next = interview.questions.findIndex((q) => !answered.has(String(q._id)));
  if (next < 0 && interview.questions.length && interview.status === 'in_progress') {
    interview.currentQuestionIndex = interview.questions.length;
    await finalize(interview);
  }
  res.json({ success: true, serverTime: new Date(), interview: {
    ...interview.toObject(), questions: interview.questions.map((q) => publicQuestion(q, isFinished(interview))),
    currentQuestionIndex: next < 0 ? interview.questions.length : next,
    answeredQuestionIds: [...answered], answers, endsAt: endsAt(interview),
  } });
}));
export const startInterview = safe(async (req, res) => withInterviewLock(req.params.id, async () => {
  const interview = await ownedInterview(req.params.id, req.user._id);
  if (isFinished(interview)) throw new ValidationError('This interview has ended. View its results.');
  if (interview.status === 'created') {
    interview.status = 'in_progress'; interview.startedAt = new Date(); await interview.save();
  }
  res.json({ success: true, status: interview.status, startedAt: interview.startedAt, endsAt: endsAt(interview), serverTime: new Date() });
}));
export const submitAnswer = safe(async (req, res) => {
  const receivedAt = Date.now();
  await withInterviewLock(req.params.id, async () => {
    const interview = await ownedInterview(req.params.id, req.user._id);
    const { questionId, responseText = '', responseType = 'text', timeSpentSeconds = 0, skipped = false } = req.body;
    if (typeof questionId !== 'string' || !mongoose.Types.ObjectId.isValid(questionId)) throw new ValidationError('Choose a valid question.');
    if (typeof responseText !== 'string' || responseText.length > 20000 || (!skipped && !responseText.trim())) throw new ValidationError('Enter an answer of up to 20,000 characters, or skip this question.');
    if (!['text', 'voice'].includes(responseType) || typeof skipped !== 'boolean') throw new ValidationError('Invalid answer format.');
    // Idempotent retries recover a response lost after a successful save.
    const existing = await Answer.findOne({ interviewId: interview._id, questionId });
    const restoredNext = await restoreProgress(interview);
    if (existing) {
      if (restoredNext < 0 && !isFinished(interview)) await finalize(interview);
      else await interview.save();
      return res.json({ success: true, evaluation: existing, nextQuestionIndex: interview.currentQuestionIndex, isComplete: isFinished(interview), interviewStatus: interview.status, replayed: true });
    }
    assertActive(interview);
    const grace = interview.mode === 'assessment' ? 2000 : 120000;
    if (receivedAt > endsAt(interview).getTime() + grace) throw new ValidationError('The interview time limit has ended. Finish to view your results.');
    if (String(interview.questions[interview.currentQuestionIndex]) !== questionId) throw new ValidationError('Answer the current question before continuing. Reload to restore your progress.');
    const question = await Question.findOne({ _id: questionId, interviewId: interview._id });
    if (!question) throw new NotFoundError('Question not found.');
    const answer = await createStoredAnswer(interview, question, { responseText, responseType, timeSpentSeconds, skipped });
    interview.draft = null;
    const answers = await Answer.find({ interviewId: interview._id }).select('questionId');
    const answered = new Set(answers.map((a) => String(a.questionId)));
    const next = interview.questions.findIndex((q) => !answered.has(String(q)));
    interview.currentQuestionIndex = next < 0 ? interview.questions.length : next;
    await interview.save();
    if (next < 0) await finalize(interview);
    res.status(201).json({ success: true, evaluation: answer, nextQuestionIndex: interview.currentQuestionIndex, isComplete: isFinished(interview), interviewStatus: interview.status });
  });
});
export const saveDraft = safe(async (req, res) => withInterviewLock(req.params.id, async () => {
  const interview = await ownedInterview(req.params.id, req.user._id);
  assertActive(interview);
  await restoreProgress(interview);
  const { questionId, responseText, responseType = 'text', timeSpentSeconds = 0 } = req.body;
  if (typeof responseText !== 'string' || responseText.length > 20000 || !['text', 'voice'].includes(responseType)) throw new ValidationError('Invalid draft format.');
  if (Date.now() > endsAt(interview).getTime() + (interview.mode === 'assessment' ? 2000 : 120000)) throw new ValidationError('The interview time limit has ended.');
  if (String(interview.questions[interview.currentQuestionIndex]) !== questionId) throw new ValidationError('This question is no longer active.');
  interview.draft = { questionId, responseText, responseType, timeSpentSeconds: Math.max(0, Math.min(3600, Number(timeSpentSeconds) || 0)), savedAt: new Date() };
  await interview.save();
  res.json({ success: true, savedAt: interview.draft.savedAt });
}));
export const completeInterview = safe(async (req, res) => withInterviewLock(req.params.id, async () => {
  const interview = await ownedInterview(req.params.id, req.user._id);
  await restoreProgress(interview);
  if (interview.status === 'created') throw new ValidationError('This interview has not started yet.');
  const draft = interview.draft;
  if (!isFinished(interview) && !req.body?.terminated && draft?.responseText?.trim() &&
      String(draft.questionId) === String(interview.questions[interview.currentQuestionIndex]) &&
      new Date(draft.savedAt).getTime() <= endsAt(interview).getTime() + (interview.mode === 'assessment' ? 2000 : 120000)) {
    const existing = await Answer.findOne({ interviewId: interview._id, questionId: draft.questionId });
    const question = await Question.findOne({ _id: draft.questionId, interviewId: interview._id });
    if (question && !existing) await createStoredAnswer(interview, question, draft);
    interview.currentQuestionIndex += 1;
    interview.draft = null;
    await interview.save();
  }

  await finalize(interview, req.body?.terminated === true, typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null);
  res.json({ success: true, status: interview.status, overallScore: interview.overallScore, terminationReason: interview.terminationReason, completedAt: interview.completedAt });
}));
export const getHistory = safe(async (req, res) => {
  const interviews = await Interview.find({ userId: req.user._id }).sort({ createdAt: -1 }).select('-__v').lean();
  const answers = await Answer.find({ userId: req.user._id }).select('interviewId overallScore skipped evaluationStatus evaluationKind isFallbackEvaluation evaluationProvider');
  for (const interview of interviews) if (isFinished(interview)) {
    const own = answers.filter((a) => String(a.interviewId) === String(interview._id));
    Object.assign(interview, summarizeScore(own, interview.questions.length));
    interview.gradedAnswerCount = own.filter((a) => !a.skipped && !a.isFallbackEvaluation && a.evaluationProvider === 'local' && typeof a.overallScore === 'number').length;
  }
  res.json({ success: true, count: interviews.length, interviews });
});
export const getReport = safe(async (req, res) => {
  const interview = await ownedInterview(req.params.id, req.user._id, true);
  if (!isFinished(interview)) throw new ForbiddenError('Finish the interview to view reference answers and the full report.');
  const answers = await Answer.find({ interviewId: interview._id });
  Object.assign(interview, summarizeScore(answers, interview.questions.length));
  const report = interview.questions.map((question) => {
    const data = question.toObject(), guide = findBankQuestion(question);
    if (!data.referenceAnswer && guide) { data.referenceAnswer = guide.referenceAnswer; data.answerSource = 'curated'; }
    if (!data.followUpQuestions?.length && guide) data.followUpQuestions = guide.followUpQuestions;
    return { question: data, answer: answers.find((a) => String(a.questionId) === String(question._id)) || null };
  });
  res.json({ success: true, interview, report });
});
