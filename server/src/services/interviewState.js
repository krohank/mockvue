import Answer from '../models/Answer.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../utils/customErrors.js';
import Interview from '../models/Interview.js';
import mongoose from 'mongoose';
import { summarizeScore } from './scoreSummary.js';

const locks = new Map();
export async function withInterviewLock(id, action) {
  const previous = locks.get(id) || Promise.resolve();
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => pending);
  locks.set(id, tail);
  await previous.catch(() => {});
  try { return await action(); } finally {
    release();
    if (locks.get(id) === tail) locks.delete(id);
  }
}
export async function ownedInterview(id, userId, populate = false) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid interview ID.');
  const query = Interview.findById(id);
  const interview = await (populate ? query.populate('questions') : query);
  if (!interview) throw new NotFoundError('Interview not found.');
  if (String(interview.userId) !== String(userId)) throw new ForbiddenError('You cannot access this interview.');
  return interview;
}
export const isFinished = (interview) => ['completed', 'terminated', 'abandoned'].includes(interview.status);
export const endsAt = (interview) => interview.startedAt
  ? new Date(new Date(interview.startedAt).getTime() + interview.durationMinutes * 60000) : null;
export function assertActive(interview) {
  if (isFinished(interview)) throw new ValidationError('This interview has ended.');
  if (interview.status !== 'in_progress') throw new ValidationError('Start the interview before submitting answers.');
}
export async function finalize(interview, terminated = false, reason = null) {
  const answers = await Answer.find({ interviewId: interview._id });
  interview.status = terminated || interview.status === 'terminated' ? 'terminated' : 'completed';
  Object.assign(interview, summarizeScore(answers, interview.questions.length));
  interview.completedAt = interview.completedAt || new Date();
  if (reason) interview.terminationReason = reason;
  await interview.save();
  return interview;
}
