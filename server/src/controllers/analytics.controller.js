import Interview from '../models/Interview.js';
import Answer from '../models/Answer.js';
import { summarizeScore } from '../services/scoreSummary.js';
import { ownedInterview, withInterviewLock, assertActive, finalize } from '../services/interviewState.js';
import MonitoringEvent from '../models/MonitoringEvent.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/customErrors.js';

const modelGraded = (a) => !a.skipped && !a.isFallbackEvaluation && a.evaluationProvider === 'local' && !['pending', 'processing'].includes(a.evaluationStatus) && typeof a.overallScore === 'number';
async function practiceData(userId) {
  const completed = await Interview.find({ userId, status: { $in: ['completed', 'terminated', 'abandoned'] } }).sort({ completedAt: 1 }).lean();
  const answers = await Answer.find({ userId, interviewId: { $in: completed.map((i) => i._id) } }).populate('questionId', 'topic difficulty');
  for (const i of completed) {
    const own = answers.filter((a) => String(a.interviewId) === String(i._id));
    Object.assign(i, summarizeScore(own, i.questions.length));
    i.hasModelGrades = own.some(modelGraded);
  }
  return { completed, answers, scored: completed.filter((i) => i.scoreStatus === 'graded' && i.hasModelGrades) };
}
export const getOverview = async (req, res, next) => {
  try {
    const { completed, answers, scored } = await practiceData(req.user._id);
    const totalInterviews = await Interview.countDocuments({ userId: req.user._id });
    res.json({ success: true, overview: {
      totalInterviews, completedCount: completed.length, gradedCount: scored.length,
      guidedAnswerCount: answers.filter((a) => !a.skipped && a.isFallbackEvaluation).length,
      averageScore: scored.length ? Math.round(scored.reduce((n, i) => n + i.overallScore, 0) / scored.length) : null,
      totalMinutesPracticed: Math.round(completed.reduce((n, i) => n + (i.startedAt && i.completedAt ? Math.min(i.durationMinutes, Math.max(0, (i.completedAt - i.startedAt) / 60000)) : 0), 0)),
      readinessStatus: 'Practice feedback does not establish hiring readiness.',
      recentScores: scored.slice(-5).map((i) => ({ id: i._id, title: i.title, score: i.overallScore, difficulty: i.difficulty, date: i.completedAt })),
    } });
  } catch (error) { next(error); }
};
export const getPerformance = async (req, res, next) => {
  try {
    const { answers, scored } = await practiceData(req.user._id);
    const graded = answers.filter(modelGraded), topicMap = new Map();
    for (const a of graded) {
      const topic = a.questionId?.topic;
      if (!topic) continue;
      const old = topicMap.get(topic) || { total: 0, count: 0 };
      old.total += a.overallScore; old.count++; topicMap.set(topic, old);
    }
    const topicPerformance = [...topicMap].map(([topic, n]) => ({ topic, averageScore: Math.round(n.total / n.count), attempts: n.count }));
    const weakestTopics = topicPerformance.filter((t) => t.averageScore < 65).sort((a, b) => a.averageScore - b.averageScore);
    const strongestTopics = topicPerformance.filter((t) => t.averageScore >= 65).sort((a, b) => b.averageScore - a.averageScore);
    const recommended = weakestTopics[0] || [...topicPerformance].sort((a, b) => a.attempts - b.attempts)[0];
    res.json({ success: true, analytics: {
      scoreTrend: scored.map((i, idx) => ({ index: idx + 1, interviewId: i._id, title: i.title, difficulty: i.difficulty, score: i.overallScore, date: new Date(i.completedAt).toLocaleDateString() })),
      topicPerformance, strongestTopics, weakestTopics,
      difficultyPerformance: ['Easy', 'Medium', 'Hard'].map((difficulty) => { const list = scored.filter((i) => i.difficulty === difficulty); return { difficulty, averageScore: list.length ? Math.round(list.reduce((n, i) => n + i.overallScore, 0) / list.length) : null, count: list.length }; }),
      recommendation: { topic: recommended?.topic || 'Data Structures & Algorithms', difficulty: 'Medium', reason: recommended ? 'Based on available local-model practice scores. Review individual feedback before drawing conclusions.' : 'Choose a topic to practice. Guided answers are recorded without a correctness score.' },
      totalAnswersAnalyzed: graded.length,
      guidedAnswerCount: answers.filter((a) => !a.skipped && a.isFallbackEvaluation).length,
      pendingAnswerCount: answers.filter((a) => ['pending', 'processing'].includes(a.evaluationStatus)).length,
    } });
  } catch (error) { next(error); }
};

export const logMonitoringEvent = async (req, res, next) => {
  try {
    await withInterviewLock(req.params.id, async () => {
      const interview = await ownedInterview(req.params.id, req.user._id);
      assertActive(interview);
      const { eventType, description, durationSeconds = 0, confidence = 0 } = req.body;
      if (!MonitoringEvent.schema.path('eventType').enumValues.includes(eventType)) throw new ValidationError('Choose a valid session event.');
      const event = await MonitoringEvent.create({
        interviewId: interview._id, userId: req.user._id, eventType,
        description: typeof description === 'string' ? description.slice(0, 500) : String(eventType || '').replace(/_/g, ' '),
        durationSeconds: Math.max(0, Number(durationSeconds) || 0), confidence: Math.min(1, Math.max(0, Number(confidence) || 0)),
      });
      interview.proctoringViolations += 1;
      await interview.save();
      if (interview.mode === 'assessment' && ['tab_switched', 'fullscreen_exit', 'max_warnings_exceeded'].includes(eventType)) {
        await finalize(interview, true, eventType === 'fullscreen_exit' ? 'Interview ended because full-screen mode was exited.' : 'Interview ended because an assessment rule was broken.');
      }
      res.status(201).json({ success: true, event, totalViolations: interview.proctoringViolations, isTerminated: interview.status === 'terminated', terminationReason: interview.terminationReason });
    });
  } catch (error) { next(error); }
};

export const getMonitoringEvents = async (req, res, next) => {
  try {
    const { id } = req.params;
    const interview = await Interview.findById(id);

    if (!interview) {
      throw new NotFoundError('Interview session not found.');
    }
    if (interview.userId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError('Unauthorized.');
    }

    const events = await MonitoringEvent.find({ interviewId: interview._id }).sort({ timestamp: 1 });

    res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    next(error);
  }
};
