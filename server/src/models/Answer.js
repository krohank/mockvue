import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true, index: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    responseType: {
      type: String,
      enum: ['text', 'voice', 'mixed'],
      default: 'text',
    },
    responseText: {
      type: String,
      required: [true, 'Candidate answer text is required'],
      trim: true,
    },
    transcriptConfidence: { type: Number, default: null },
    overallScore: { type: Number, min: 0, max: 100, required: true },
    criteriaScores: {
      technicalCorrectness: { type: Number, min: 0, max: 40, default: 0 },
      relevance: { type: Number, min: 0, max: 20, default: 0 },
      completeness: { type: Number, min: 0, max: 20, default: 0 },
      clarity: { type: Number, min: 0, max: 20, default: 0 },
    },
    correctConcepts: { type: [String], default: [] },
    missingConcepts: { type: [String], default: [] },
    mistakes: { type: [String], default: [] },
    explanation: { type: String, default: '' },
    feedback: { type: String, default: '' },
    improvedAnswer: { type: String, default: '' },
    recommendedTopics: { type: [String], default: [] },
    timeSpentSeconds: { type: Number, min: 0, default: 0 },
    isFallbackEvaluation: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One answer per question per interview.
answerSchema.index({ interviewId: 1, questionId: 1 }, { unique: true });

const Answer = mongoose.model('Answer', answerSchema);
export default Answer;
