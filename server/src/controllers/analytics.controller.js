import Interview from '../models/Interview.js';
import Answer from '../models/Answer.js';
import MonitoringEvent from '../models/MonitoringEvent.js';
import { ValidationError } from '../utils/customErrors.js';
import {
  MONITORING_EVENT_SEVERITY,
  MAX_PROCTORING_WARNINGS,
} from '../config/constants.js';
import { asTrimmedString } from '../utils/validation.js';
import {
  finalizeInterview,
  expireOverdueForUser,
  getDeadline,
} from '../services/interviewLifecycle.js';
import { loadOwnedInterview } from './interview.controller.js';

const FINISHED = ['completed', 'terminated'];
const DAY_MS = 86_400_000;

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round = (v) => (v === null || v === undefined ? null : Math.round(v));

const dayKey = (date) => new Date(date).toISOString().slice(0, 10);

/** Consecutive days with at least one finished session, ending today or yesterday. */
export const computeStreak = (dates, now = new Date()) => {
  const days = new Set(dates.map(dayKey));
  let cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor = new Date(cursor.getTime() - DAY_MS);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
};

const minutesSpent = (i) => {
  if (i.startedAt && i.completedAt) {
    const actual = (new Date(i.completedAt) - new Date(i.startedAt)) / 60_000;
    return Math.max(0, Math.min(actual, i.durationMinutes || actual));
  }
  return 0;
};

export const readinessFor = (completedCount, avgScore) => {
  if (completedCount === 0) return 'Not Started';
  if (avgScore >= 75) return 'Placement Ready';
  if (avgScore >= 55) return 'Progressing';
  return 'Needs Practice';
};

export const getOverview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await expireOverdueForUser(userId);

    const all = await Interview.find({ userId }).sort({ createdAt: -1 }).lean();
    const finished = all
      .filter((i) => FINISHED.includes(i.status))
      .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

    const scores = finished.map((i) => i.overallScore || 0);
    const averageScore = round(mean(scores)) ?? 0;
    const active = all.find((i) => ['in_progress', 'created'].includes(i.status));
    const thirtyDaysAgo = Date.now() - 30 * DAY_MS;

    res.status(200).json({
      success: true,
      overview: {
        totalInterviews: all.length,
        completedCount: finished.length,
        terminatedCount: finished.filter((i) => i.status === 'terminated').length,
        averageScore,
        bestScore: scores.length ? Math.max(...scores) : null,
        totalMinutesPracticed: Math.round(finished.reduce((sum, i) => sum + minutesSpent(i), 0)),
        readinessStatus: readinessFor(finished.length, averageScore),
        streakDays: computeStreak(finished.map((i) => i.completedAt).filter(Boolean)),
        practiceDaysLast30: new Set(
          finished.filter((i) => new Date(i.completedAt) >= thirtyDaysAgo).map((i) => dayKey(i.completedAt))
        ).size,
        lastSessionAt: finished[0]?.completedAt || null,
        activeSession: active
          ? {
              _id: active._id,
              title: active.title,
              status: active.status,
              startedAt: active.startedAt,
              deadline: getDeadline(active),
              questionCount: active.questions?.length || 0,
            }
          : null,
        recentScores: finished
          .slice(0, 6)
          .map((i) => ({ id: i._id, title: i.title, score: i.overallScore || 0, difficulty: i.difficulty, date: i.completedAt }))
          .reverse(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getPerformance = async (req, res, next) => {
  try {
    const userId = req.user._id;
    await expireOverdueForUser(userId);

    const completed = await Interview.find({ userId, status: { $in: FINISHED } })
      .sort({ completedAt: 1 })
      .select('title difficulty overallScore completedAt topics status proctoringSummary proctoringViolations')
      .lean();

    const scoreTrend = completed.map((i, idx) => ({
      index: idx + 1,
      interviewId: i._id,
      title: i.title,
      difficulty: i.difficulty,
      status: i.status,
      score: i.overallScore || 0,
      date: i.completedAt,
    }));

    const answers = await Answer.find({ userId }).populate('questionId', 'topic difficulty').lean();

    const topicAgg = new Map();
    const criteria = { technicalCorrectness: [], relevance: [], completeness: [], clarity: [] };
    const maxima = { technicalCorrectness: 40, relevance: 20, completeness: 20, clarity: 20 };

    for (const ans of answers) {
      const topic = ans.questionId?.topic || 'General';
      const agg = topicAgg.get(topic) || { total: 0, count: 0 };
      agg.total += ans.overallScore || 0;
      agg.count += 1;
      topicAgg.set(topic, agg);
      for (const key of Object.keys(criteria)) {
        const v = ans.criteriaScores?.[key];
        if (typeof v === 'number') criteria[key].push((v / maxima[key]) * 100);
      }
    }

    const topicPerformance = [...topicAgg.entries()]
      .map(([topic, { total, count }]) => ({ topic, averageScore: Math.round(total / count), attempts: count }))
      .sort((a, b) => b.averageScore - a.averageScore);

    const criteriaAverages = Object.fromEntries(
      Object.entries(criteria).map(([k, values]) => [k, round(mean(values))])
    );

    const difficultyPerformance = ['Easy', 'Medium', 'Hard'].map((difficulty) => {
      const rows = completed.filter((i) => i.difficulty === difficulty);
      return {
        difficulty,
        averageScore: rows.length ? Math.round(mean(rows.map((r) => r.overallScore || 0))) : 0,
        count: rows.length,
      };
    });

    const strongestTopics = topicPerformance.filter((t) => t.averageScore >= 65);
    const weakestTopics = [...topicPerformance].reverse().filter((t) => t.averageScore < 65);

    let recommendation = {
      topic: 'Data Structures & Algorithms',
      difficulty: 'Medium',
      reason: 'Take a first interview to establish a baseline across the four rubric criteria.',
    };
    if (weakestTopics.length > 0) {
      const weakest = weakestTopics[0];
      recommendation = {
        topic: weakest.topic,
        difficulty: weakest.averageScore < 45 ? 'Easy' : 'Medium',
        reason: `Your average in ${weakest.topic} is ${weakest.averageScore}% across ${weakest.attempts} answer${weakest.attempts === 1 ? '' : 's'}. A focused session here will lift your overall score the most.`,
      };
    } else if (topicPerformance.length > 0) {
      const best = topicPerformance[0];
      recommendation = {
        topic: best.topic,
        difficulty: 'Hard',
        reason: `You average ${best.averageScore}% in ${best.topic}. Try Hard questions to keep improving.`,
      };
    }

    const monitored = completed.filter((i) => i.proctoringSummary && i.proctoringSummary.engine !== 'none');
    const proctoring = {
      sessionsMonitored: monitored.length,
      avgAttentionPct: round(mean(monitored.map((i) => i.proctoringSummary.attentionPct).filter((v) => typeof v === 'number'))),
      avgFacePresentPct: round(mean(monitored.map((i) => i.proctoringSummary.facePresentPct).filter((v) => typeof v === 'number'))),
      totalWarnings: completed.reduce((sum, i) => sum + (i.proctoringViolations || 0), 0),
      terminatedSessions: completed.filter((i) => i.status === 'terminated').length,
    };

    res.status(200).json({
      success: true,
      analytics: {
        scoreTrend,
        topicPerformance,
        difficultyPerformance,
        criteriaAverages,
        strongestTopics,
        weakestTopics,
        recommendation,
        proctoring,
        totalAnswersAnalyzed: answers.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

const TERMINATION_REASONS = {
  tab_switched: 'You left the interview tab.',
  fullscreen_exit: 'You exited full-screen mode.',
  window_focus_lost: 'You switched to another window or application.',
  max_warnings_exceeded: `You reached the limit of ${MAX_PROCTORING_WARNINGS} proctoring warnings.`,
};

/** Keeps only small primitive values so clients cannot store arbitrary blobs. */
export const sanitizeMetadata = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(raw).slice(0, 12)) {
    const safeKey = String(key).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32);
    if (!safeKey) continue;
    if (typeof value === 'number' && Number.isFinite(value)) out[safeKey] = Math.round(value * 1000) / 1000;
    else if (typeof value === 'boolean') out[safeKey] = value;
    else if (typeof value === 'string') out[safeKey] = value.slice(0, 80);
  }
  return Object.keys(out).length ? out : undefined;
};

export const logMonitoringEvent = async (req, res, next) => {
  try {
    const { eventType } = req.body || {};
    const severity = MONITORING_EVENT_SEVERITY[eventType];
    if (!severity) {
      throw new ValidationError('Unknown monitoring event type.');
    }

    const interview = await loadOwnedInterview(req.params.id, req.user._id);

    if (interview.status !== 'in_progress') {
      return res.status(200).json({
        success: true,
        accepted: false,
        status: interview.status,
        isTerminated: interview.status === 'terminated',
        terminationReason: interview.terminationReason,
        totalWarnings: interview.proctoringViolations,
        maxWarnings: MAX_PROCTORING_WARNINGS,
      });
    }

    const countsAsWarning = severity === 'warning';
    let current = interview;
    if (countsAsWarning) {
      current = await Interview.findOneAndUpdate(
        { _id: interview._id, status: 'in_progress' },
        { $inc: { proctoringViolations: 1 } },
        { new: true }
      );
      if (!current) {
        const latest = await Interview.findById(interview._id);
        return res.status(200).json({
          success: true,
          accepted: false,
          status: latest.status,
          isTerminated: latest.status === 'terminated',
          terminationReason: latest.terminationReason,
          totalWarnings: latest.proctoringViolations,
          maxWarnings: MAX_PROCTORING_WARNINGS,
        });
      }
    }

    const duration = Number(req.body.durationSeconds);
    const confidence = Number(req.body.confidence);
    const event = await MonitoringEvent.create({
      interviewId: interview._id,
      userId: req.user._id,
      eventType,
      severity,
      countedAsWarning: countsAsWarning,
      durationSeconds: Number.isFinite(duration) ? Math.min(Math.max(duration, 0), 7200) : 0,
      confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.85,
      description: asTrimmedString(req.body.description, 500) || eventType.replace(/_/g, ' '),
      metadata: sanitizeMetadata(req.body.metadata),
    });

    let terminationReason = null;
    if (severity === 'critical') {
      terminationReason = TERMINATION_REASONS[eventType] || 'A critical proctoring rule was broken.';
    } else if (countsAsWarning && current.proctoringViolations >= MAX_PROCTORING_WARNINGS) {
      terminationReason = TERMINATION_REASONS.max_warnings_exceeded;
    }

    if (terminationReason) {
      current = await finalizeInterview(current, {
        status: 'terminated',
        endReason: 'proctoring',
        terminationReason,
      });
    }

    res.status(201).json({
      success: true,
      accepted: true,
      event,
      severity,
      countedAsWarning: countsAsWarning,
      totalWarnings: current.proctoringViolations,
      maxWarnings: MAX_PROCTORING_WARNINGS,
      status: current.status,
      isTerminated: current.status === 'terminated',
      terminationReason: current.terminationReason,
    });
  } catch (error) {
    next(error);
  }
};

export const getMonitoringEvents = async (req, res, next) => {
  try {
    const interview = await loadOwnedInterview(req.params.id, req.user._id);
    const events = await MonitoringEvent.find({ interviewId: interview._id }).sort({ timestamp: 1 }).lean();

    const bySeverity = { info: 0, warning: 0, critical: 0 };
    for (const e of events) bySeverity[e.severity || 'warning'] += 1;

    res.status(200).json({
      success: true,
      count: events.length,
      bySeverity,
      events,
    });
  } catch (error) {
    next(error);
  }
};
