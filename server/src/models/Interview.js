import mongoose from 'mongoose';
import { DIFFICULTIES, INTERVIEW_TYPES, CV_ENGINES, END_REASONS } from '../config/constants.js';

const proctoringSummarySchema = new mongoose.Schema(
  {
    engine: { type: String, enum: CV_ENGINES, default: 'none' },
    calibrated: { type: Boolean, default: false },
    framesAnalyzed: { type: Number, min: 0, default: 0 },
    monitoredSeconds: { type: Number, min: 0, default: 0 },
    // Percentages of monitored time (0-100)
    facePresentPct: { type: Number, min: 0, max: 100, default: null },
    attentionPct: { type: Number, min: 0, max: 100, default: null },
    multiplePeoplePct: { type: Number, min: 0, max: 100, default: null },
    speakingPct: { type: Number, min: 0, max: 100, default: null },
    phoneDetections: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    targetRole: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: DIFFICULTIES, required: true },
    interviewType: { type: String, enum: INTERVIEW_TYPES, default: 'Technical' },
    topics: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one topic must be selected',
      },
    },
    status: {
      type: String,
      enum: ['created', 'in_progress', 'completed', 'abandoned', 'terminated'],
      default: 'created',
      index: true,
    },
    endReason: { type: String, enum: [...END_REASONS, null], default: null },
    terminationReason: { type: String, default: null },
    proctoringViolations: { type: Number, default: 0 },
    proctoringSummary: { type: proctoringSummarySchema, default: null },
    durationMinutes: { type: Number, default: 20 },
    currentQuestionIndex: { type: Number, default: 0 },
    overallScore: { type: Number, min: 0, max: 100, default: null },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    isFallbackAI: { type: Boolean, default: false },
    aiProvider: { type: String, default: null },
  },
  { timestamps: true }
);

interviewSchema.index({ userId: 1, createdAt: -1 });

const Interview = mongoose.model('Interview', interviewSchema);
export default Interview;
