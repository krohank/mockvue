import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    responseType: {
      type: String,
      enum: ['text', 'voice'],
      default: 'text',
    },
    responseText: {
      type: String,
      required: [true, 'Candidate answer text is required'],
      trim: true,
    },
    skipped: { type: Boolean, default: false },
    transcriptConfidence: {
      type: Number,
      default: null,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    evaluationStatus: { type: String, enum: ['pending', 'processing', 'completed'], default: 'completed', index: true },
    gradingStartedAt: { type: Date, default: null },
    gradingAttempts: { type: Number, default: 0 },
    evaluationKind: { type: String, enum: ['rubric', 'concept-check', 'skipped'], default: null },
    coveragePercent: { type: Number, min: 0, max: 100, default: null },
    mentionedConcepts: { type: [String], default: [] },
    followUpQuestions: { type: [String], default: [] },
    answerSource: { type: String, enum: ['curated', 'local-model', 'outline'], default: null },
    criteriaScores: {
      technicalCorrectness: { type: Number, min: 0, max: 40, default: 0 },
      relevance: { type: Number, min: 0, max: 20, default: 0 },
      completeness: { type: Number, min: 0, max: 20, default: 0 },
      clarity: { type: Number, min: 0, max: 20, default: 0 },
    },
    correctConcepts: {
      type: [String],
      default: [],
    },
    missingConcepts: {
      type: [String],
      default: [],
    },
    mistakes: {
      type: [String],
      default: [],
    },
    explanation: {
      type: String,
      default: '',
    },
    feedback: {
      type: String,
      default: '',
    },
    improvedAnswer: {
      type: String,
      default: '',
    },
    recommendedTopics: {
      type: [String],
      default: [],
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },
    isFallbackEvaluation: {
      type: Boolean,
      default: false,
    },
    evaluationProvider: { type: String, enum: ['local', 'fallback'], default: null },
    evaluationModel: { type: String, default: null },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate answers to the same question within an interview
answerSchema.index({ interviewId: 1, questionId: 1 }, { unique: true });

const Answer = mongoose.model('Answer', answerSchema);
export default Answer;
