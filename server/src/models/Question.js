import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    orderIndex: {
      type: Number,
      required: true,
    },
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true,
    },
    type: {
      type: String,
      enum: ['Technical', 'HR', 'Behavioral'],
      default: 'Technical',
    },
    referenceConcepts: {
      type: [String],
      default: [],
    },
    bankId: String,
    referenceAnswer: { type: String, default: '' },
    answerSource: { type: String, enum: ['curated', 'local-model', 'outline'], default: 'outline' },
    followUpQuestions: { type: [String], default: [] },
    evaluationCriteria: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast question sequence querying
questionSchema.index({ interviewId: 1, orderIndex: 1 });

const Question = mongoose.model('Question', questionSchema);
export default Question;
