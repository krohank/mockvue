import Interview from '../models/Interview.js';
import Answer from '../models/Answer.js';
import { INTERVIEW_LIMITS, CV_ENGINES } from '../config/constants.js';

export const FINAL_STATUSES = ['completed', 'terminated', 'abandoned'];
export const ACTIVE_STATUSES = ['created', 'in_progress'];

export const isFinal = (interview) => FINAL_STATUSES.includes(interview?.status);

/** Absolute deadline (Date) for an interview that has started, otherwise null. */
export const getDeadline = (interview) => {
  if (!interview?.startedAt) return null;
  return new Date(new Date(interview.startedAt).getTime() + (interview.durationMinutes || 20) * 60_000);
};

/** True once the deadline plus the submission grace window has passed. */
export const isPastDeadline = (interview, now = Date.now(), graceSeconds = INTERVIEW_LIMITS.answerGraceSeconds) => {
  const deadline = getDeadline(interview);
  if (!deadline) return false;
  return now > deadline.getTime() + graceSeconds * 1000;
};

/**
 * Overall score is the mean over ALL questions in the session. Unanswered
 * questions count as zero, so ending early cannot inflate the result.
 */
export const computeOverallScore = (answerScores, totalQuestions) => {
  const total = Math.max(totalQuestions || 0, answerScores.length);
  if (total === 0) return 0;
  const sum = answerScores.reduce((acc, s) => acc + (Number(s) || 0), 0);
  return Math.round(sum / total);
};

const clampPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
};

const clampCount = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), 10_000_000);
};

/** Validates the client-reported proctoring summary; never trust raw input. */
export const sanitizeProctoringSummary = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  return {
    engine: CV_ENGINES.includes(raw.engine) ? raw.engine : 'none',
    calibrated: Boolean(raw.calibrated),
    framesAnalyzed: clampCount(raw.framesAnalyzed),
    monitoredSeconds: clampCount(raw.monitoredSeconds),
    facePresentPct: clampPct(raw.facePresentPct),
    attentionPct: clampPct(raw.attentionPct),
    multiplePeoplePct: clampPct(raw.multiplePeoplePct),
    speakingPct: clampPct(raw.speakingPct),
    phoneDetections: clampCount(raw.phoneDetections),
  };
};

/**
 * Moves an active interview into a final state exactly once, computing the
 * overall score. Safe against concurrent callers: the status transition is a
 * conditional update, so only the first caller wins.
 */
export const finalizeInterview = async (interview, { status = 'completed', endReason = null, terminationReason = null } = {}) => {
  if (isFinal(interview)) return interview;

  const answers = await Answer.find({ interviewId: interview._id }).select('overallScore').lean();
  const overallScore = computeOverallScore(
    answers.map((a) => a.overallScore),
    interview.questions?.length || 0
  );

  const update = {
    status,
    overallScore,
    completedAt: new Date(),
    currentQuestionIndex: answers.length,
    endReason,
  };
  if (terminationReason) update.terminationReason = terminationReason;

  const updated = await Interview.findOneAndUpdate(
    { _id: interview._id, status: { $in: ACTIVE_STATUSES } },
    { $set: update },
    { new: true }
  );

  return updated || (await Interview.findById(interview._id));
};

/** Lazily closes an in-progress interview whose time has run out. */
export const expireIfOverdue = async (interview, now = Date.now()) => {
  if (interview?.status === 'in_progress' && isPastDeadline(interview, now)) {
    return finalizeInterview(interview, { status: 'completed', endReason: 'time_expired' });
  }
  return interview;
};

/** Closes every overdue in-progress interview for a user. */
export const expireOverdueForUser = async (userId, now = Date.now()) => {
  const active = await Interview.find({ userId, status: 'in_progress', startedAt: { $ne: null } });
  const overdue = active.filter((i) => isPastDeadline(i, now));
  for (const interview of overdue) {
    await finalizeInterview(interview, { status: 'completed', endReason: 'time_expired' });
  }
  return overdue.length;
};
