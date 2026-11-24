import mongoose from 'mongoose';

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    targetRole: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true,
    },
    interviewType: {
      type: String,
      enum: ['Technical', 'HR', 'Behavioral', 'Mixed'],
      default: 'Technical',
    },
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
    terminationReason: {
      type: String,
      default: null,
    },
    proctoringViolations: {
      type: Number,
      default: 0,
    },
    durationMinutes: {
      type: Number,
      default: 20,
    },
    mode: { type: String, enum: ['practice', 'assessment'], default: 'practice' },
    generationNotice: { type: String, default: null },
    draft: {
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
      responseText: { type: String, maxlength: 20000 },
      responseType: { type: String, enum: ['text', 'voice'] },
      timeSpentSeconds: Number,
      savedAt: Date,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    scoreStatus: { type: String, enum: ['pending', 'ungraded', 'graded'], default: null },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    isFallbackAI: {
      type: Boolean,
      default: false,
    },
    questionProvider: { type: String, enum: ['local', 'fallback'], default: null },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user interviews by date
interviewSchema.index({ userId: 1, createdAt: -1 });

const Interview = mongoose.model('Interview', interviewSchema);
export default Interview;
