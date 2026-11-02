import Interview from '../models/Interview.js';
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import MonitoringEvent from '../models/MonitoringEvent.js';
import { aiService } from '../services/ai/AIProviderFactory.js';
import { AppError, NotFoundError, ForbiddenError, ValidationError } from '../utils/customErrors.js';
import { assertObjectId, clampInt, oneOf, asTrimmedString } from '../utils/validation.js';
import {
  TARGET_ROLES,
  DIFFICULTIES,
  INTERVIEW_TYPES,
  QUESTION_TYPES,
  TOPICS,
  INTERVIEW_LIMITS,
  MAX_PROCTORING_WARNINGS,
} from '../config/constants.js';
import {
  isFinal,
  getDeadline,
  isPastDeadline,
  finalizeInterview,
  expireIfOverdue,
  expireOverdueForUser,
  sanitizeProctoringSummary,
} from '../services/interviewLifecycle.js';

/** Loads an interview and verifies the requester owns it. */
export const loadOwnedInterview = async (id, userId, { populateQuestions = false } = {}) => {
  assertObjectId(id, 'interview ID');
  const query = Interview.findById(id);
  if (populateQuestions) query.populate({ path: 'questions', options: { sort: { orderIndex: 1 } } });
  const interview = await query;
  if (!interview) throw new NotFoundError('Interview session not found.');
  if (interview.userId.toString() !== userId.toString()) {
    throw new ForbiddenError('You do not have access to this interview session.');
  }
  return interview;
};

const timingInfo = (interview) => ({
  deadline: getDeadline(interview),
  serverTime: new Date().toISOString(),
  maxWarnings: MAX_PROCTORING_WARNINGS,
});

export const generateInterview = async (req, res, next) => {
  try {
    const body = req.body || {};
    const targetRole = oneOf(body.targetRole, TARGET_ROLES, 'target role');
    const difficulty = oneOf(body.difficulty ?? 'Medium', DIFFICULTIES, 'difficulty');
    const interviewType = oneOf(body.interviewType ?? 'Technical', INTERVIEW_TYPES, 'interview type');

    const topics = Array.isArray(body.topics)
      ? [...new Set(body.topics.filter((t) => TOPICS.includes(t)))].slice(0, INTERVIEW_LIMITS.maxTopics)
      : [];
    if (topics.length === 0) {
      throw new ValidationError('Select at least one topic.');
    }

    const count = clampInt(body.questionCount, INTERVIEW_LIMITS.minQuestions, INTERVIEW_LIMITS.maxQuestions, 5);
    const duration = clampInt(
      body.durationMinutes,
      INTERVIEW_LIMITS.minDurationMinutes,
      INTERVIEW_LIMITS.maxDurationMinutes,
      20
    );

    const aiResult = await aiService.generateQuestions({
      targetRole,
      topics,
      difficulty,
      interviewType,
      experienceLevel: req.user.experienceLevel || 'Entry-Level',
      questionCount: count,
    });

    const generated = (aiResult.questions || []).slice(0, count);
    if (generated.length === 0) {
      throw new AppError('Could not generate questions for this configuration. Try different topics.', 502);
    }

    const interview = await Interview.create({
      userId: req.user._id,
      title: `${difficulty} ${interviewType} Interview · ${targetRole}`,
      targetRole,
      difficulty,
      interviewType,
      topics,
      durationMinutes: duration,
      status: 'created',
      isFallbackAI: Boolean(aiResult.isFallback),
      aiProvider: aiResult.provider || null,
    });

    const savedQuestions = await Question.insertMany(
      generated.map((q, idx) => ({
        interviewId: interview._id,
        orderIndex: idx,
        questionText: q.questionText,
        topic: q.topic || topics[0],
        difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : difficulty,
        type: QUESTION_TYPES.includes(q.type) ? q.type : interviewType === 'Mixed' ? 'Technical' : interviewType,
        referenceConcepts: Array.isArray(q.referenceConcepts) ? q.referenceConcepts.slice(0, 8) : [],
        evaluationCriteria: Array.isArray(q.evaluationCriteria) ? q.evaluationCriteria.slice(0, 6) : [],
      }))
    );

    interview.questions = savedQuestions.map((q) => q._id);
    await interview.save();

    res.status(201).json({
      success: true,
      message: 'Interview session created.',
      interviewId: interview._id,
      interview: {
        _id: interview._id,
        title: interview.title,
        targetRole,
        difficulty,
        interviewType,
        topics,
        durationMinutes: duration,
        questionCount: savedQuestions.length,
        status: interview.status,
        isFallbackAI: interview.isFallbackAI,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getInterview = async (req, res, next) => {
  try {
    let interview = await loadOwnedInterview(req.params.id, req.user._id, { populateQuestions: true });
    const wasActive = !isFinal(interview);
    interview = await expireIfOverdue(interview);
    if (wasActive && isFinal(interview)) {
      interview = await loadOwnedInterview(req.params.id, req.user._id, { populateQuestions: true });
    }

    // Reference concepts and grading criteria stay on the server until the session ends.
    const revealKeys = isFinal(interview);
    const questions = interview.questions.map((q) => {
      const qObj = q.toObject();
      if (!revealKeys) {
        delete qObj.referenceConcepts;
        delete qObj.evaluationCriteria;
      }
      return qObj;
    });

    const answers = await Answer.find({ interviewId: interview._id })
      .select('questionId overallScore submittedAt')
      .lean();

    res.status(200).json({
      success: true,
      interview: {
        ...interview.toObject(),
        questions,
        answers: answers.map((a) => ({
          questionId: a.questionId.toString(),
          overallScore: a.overallScore,
          submittedAt: a.submittedAt,
        })),
        answeredQuestionIds: answers.map((a) => a.questionId.toString()),
        ...timingInfo(interview),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const startInterview = async (req, res, next) => {
  try {
    const interview = await loadOwnedInterview(req.params.id, req.user._id);

    if (isFinal(interview)) {
      throw new AppError('This interview has already ended.', 409);
    }

    if (interview.status === 'created') {
      interview.status = 'in_progress';
      interview.startedAt = new Date();
      await interview.save();
    }

    res.status(200).json({
      success: true,
      message: 'Interview started.',
      status: interview.status,
      startedAt: interview.startedAt,
      ...timingInfo(interview),
    });
  } catch (error) {
    next(error);
  }
};

export const submitAnswer = async (req, res, next) => {
  try {
    const { questionId, responseType, timeSpentSeconds } = req.body || {};
    const responseText = typeof req.body?.responseText === 'string' ? req.body.responseText.trim() : '';

    assertObjectId(questionId, 'question ID');
    if (!responseText) {
      throw new ValidationError('Answer cannot be empty.');
    }
    if (responseText.length > INTERVIEW_LIMITS.maxAnswerLength) {
      throw new ValidationError(`Answers are limited to ${INTERVIEW_LIMITS.maxAnswerLength} characters.`);
    }

    const interview = await loadOwnedInterview(req.params.id, req.user._id);

    if (interview.status === 'created') {
      throw new AppError('Start the interview before submitting answers.', 409);
    }
    if (isFinal(interview)) {
      throw new AppError('This interview has already ended.', 409);
    }
    if (isPastDeadline(interview)) {
      await finalizeInterview(interview, { status: 'completed', endReason: 'time_expired' });
      throw new AppError('Time is up for this interview. Your earlier answers have been saved.', 409);
    }

    const question = await Question.findById(questionId);
    if (!question || question.interviewId.toString() !== interview._id.toString()) {
      throw new NotFoundError('Question not found in this interview session.');
    }

    const existingAnswer = await Answer.findOne({ interviewId: interview._id, questionId });
    if (existingAnswer) {
      return res.status(409).json({
        success: false,
        message: 'This question has already been answered.',
        evaluation: existingAnswer,
      });
    }

    const evaluation = await aiService.evaluateAnswer({
      questionText: question.questionText,
      referenceConcepts: question.referenceConcepts,
      evaluationCriteria: question.evaluationCriteria,
      candidateAnswer: responseText,
      topic: question.topic,
      difficulty: question.difficulty,
      type: question.type,
    });

    let answer;
    try {
      answer = await Answer.create({
        interviewId: interview._id,
        questionId: question._id,
        userId: req.user._id,
        responseType: ['text', 'voice', 'mixed'].includes(responseType) ? responseType : 'text',
        responseText,
        overallScore: evaluation.overallScore,
        criteriaScores: evaluation.criteriaScores,
        correctConcepts: evaluation.correctConcepts,
        missingConcepts: evaluation.missingConcepts,
        mistakes: evaluation.mistakes,
        explanation: evaluation.explanation,
        feedback: evaluation.feedback,
        improvedAnswer: evaluation.improvedAnswer,
        recommendedTopics: evaluation.recommendedTopics,
        timeSpentSeconds: clampInt(timeSpentSeconds, 0, 6 * 3600, 0),
        isFallbackEvaluation: Boolean(evaluation.isFallback),
      });
    } catch (err) {
      if (err.code === 11000) {
        const dup = await Answer.findOne({ interviewId: interview._id, questionId });
        return res.status(409).json({ success: false, message: 'This question has already been answered.', evaluation: dup });
      }
      throw err;
    }

    const answeredCount = await Answer.countDocuments({ interviewId: interview._id });
    const totalQuestions = interview.questions.length;
    const isComplete = answeredCount >= totalQuestions;

    let finalInterview = interview;
    if (isComplete) {
      finalInterview = await finalizeInterview(interview, { status: 'completed', endReason: 'all_answered' });
    } else {
      await Interview.updateOne(
        { _id: interview._id, status: 'in_progress' },
        { $set: { currentQuestionIndex: answeredCount } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Answer evaluated.',
      evaluation: answer,
      answeredCount,
      totalQuestions,
      isComplete,
      interviewStatus: finalInterview.status,
      overallScore: isComplete ? finalInterview.overallScore : null,
    });
  } catch (error) {
    next(error);
  }
};

export const completeInterview = async (req, res, next) => {
  try {
    const body = req.body || {};
    let interview = await loadOwnedInterview(req.params.id, req.user._id);
    const summary = sanitizeProctoringSummary(body.proctoringSummary);

    if (summary && !interview.proctoringSummary) {
      await Interview.updateOne({ _id: interview._id }, { $set: { proctoringSummary: summary } });
      interview.proctoringSummary = summary;
    }

    if (interview.status === 'created') {
      // Never started: close it without producing a misleading zero score.
      interview.status = 'abandoned';
      interview.completedAt = new Date();
      await interview.save();
    } else if (!isFinal(interview)) {
      if (body.terminated) {
        interview = await finalizeInterview(interview, {
          status: 'terminated',
          endReason: 'proctoring',
          terminationReason: asTrimmedString(body.reason, 300) || 'Ended by proctoring rules.',
        });
      } else {
        // Trust "time_expired" only when the clock agrees (10s tolerance for clock skew).
        const timeUp = body.endReason === 'time_expired' && isPastDeadline(interview, Date.now(), -10);
        interview = await finalizeInterview(interview, {
          status: 'completed',
          endReason: timeUp ? 'time_expired' : 'submitted_early',
        });
      }
    }

    res.status(200).json({
      success: true,
      message: interview.terminationReason ? `Interview ended: ${interview.terminationReason}` : 'Interview completed.',
      status: interview.status,
      overallScore: interview.overallScore,
      endReason: interview.endReason,
      terminationReason: interview.terminationReason,
      completedAt: interview.completedAt,
    });
  } catch (error) {
    next(error);
  }
};

export const getHistory = async (req, res, next) => {
  try {
    await expireOverdueForUser(req.user._id);
    const limit = clampInt(req.query.limit, 1, 200, 100);

    const [interviews, counts] = await Promise.all([
      Interview.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(limit).select('-__v').lean(),
      Answer.aggregate([
        { $match: { userId: req.user._id } },
        { $group: { _id: '$interviewId', count: { $sum: 1 } } },
      ]),
    ]);

    const answeredBy = new Map(counts.map((c) => [c._id.toString(), c.count]));

    res.status(200).json({
      success: true,
      count: interviews.length,
      interviews: interviews.map(({ questions, ...rest }) => ({
        ...rest,
        questionCount: questions?.length || 0,
        answeredCount: answeredBy.get(rest._id.toString()) || 0,
        deadline: getDeadline(rest),
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getReport = async (req, res, next) => {
  try {
    let interview = await loadOwnedInterview(req.params.id, req.user._id, { populateQuestions: true });
    interview = await expireIfOverdue(interview);

    if (!isFinal(interview)) {
      return res.status(409).json({
        success: false,
        status: interview.status,
        message: 'The report is available once the interview has ended.',
      });
    }
    if (!interview.populated('questions')) {
      interview = await loadOwnedInterview(req.params.id, req.user._id, { populateQuestions: true });
    }

    const answers = await Answer.find({ interviewId: interview._id }).lean();
    const byQuestion = new Map(answers.map((a) => [a.questionId.toString(), a]));

    res.status(200).json({
      success: true,
      interview,
      report: interview.questions.map((q) => ({
        question: q,
        answer: byQuestion.get(q._id.toString()) || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteInterview = async (req, res, next) => {
  try {
    const interview = await loadOwnedInterview(req.params.id, req.user._id);
    await Promise.all([
      Answer.deleteMany({ interviewId: interview._id }),
      Question.deleteMany({ interviewId: interview._id }),
      MonitoringEvent.deleteMany({ interviewId: interview._id }),
    ]);
    await interview.deleteOne();
    res.status(200).json({ success: true, message: 'Interview deleted.' });
  } catch (error) {
    next(error);
  }
};
