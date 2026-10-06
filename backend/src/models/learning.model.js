import mongoose from 'mongoose';
import { TRAINING_STATUS } from '../constants/index.js';

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });

const trainingProgramSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    category: { type: String, default: 'process' },
    durationHours: { type: Number, default: 1, min: 0 },
    contentUrl: String,
    completionCriteria: String,
    isActive: { type: Boolean, default: true },
    createdBy: ref('User'),
  },
  { timestamps: true }
);

export const TrainingProgram = mongoose.model('TrainingProgram', trainingProgramSchema);

const trainingAssignmentSchema = new mongoose.Schema(
  {
    program: { ...ref('TrainingProgram'), required: true },
    user: { ...ref('User'), required: true },
    assignedBy: ref('User'),
    dueDate: { type: String, required: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: TRAINING_STATUS, default: 'assigned' },
    completedAt: Date,
  },
  { timestamps: true }
);

trainingAssignmentSchema.index({ program: 1, user: 1 }, { unique: true });

export const TrainingAssignment = mongoose.model('TrainingAssignment', trainingAssignmentSchema);

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  options: { type: [String], validate: (v) => v.length >= 2 },
  correctIndex: { type: Number, required: true, min: 0 },
  marks: { type: Number, default: 1, min: 1 },
  explanation: String, // optional: why the answer is correct, shown in the report card
});

/*
 * Knowledge test. assignedTo empty = available to everyone.
 */
const knowledgeTestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    questions: [questionSchema],
    passPercent: { type: Number, default: 70, min: 0, max: 100 },
    maxAttempts: { type: Number, default: 2, min: 1 },
    timeLimitMinutes: { type: Number, default: 0, min: 0 }, // 0 = no limit
    // When the test taker sees the correct answers in their report card:
    // after every attempt, only once they pass or use all attempts (stops answer-sharing on retakes), or never
    showAnswers: { type: String, enum: ['after-submit', 'after-final', 'never'], default: 'after-final' },
    availableFrom: String,
    dueDate: String,
    assignedTo: [ref('User')],
    isPublished: { type: Boolean, default: true },
    createdBy: ref('User'),
  },
  { timestamps: true }
);

export const KnowledgeTest = mongoose.model('KnowledgeTest', knowledgeTestSchema);

const testAttemptSchema = new mongoose.Schema(
  {
    test: { ...ref('KnowledgeTest'), required: true },
    user: { ...ref('User'), required: true },
    attemptNo: { type: Number, required: true },
    answers: [Number],
    score: Number,
    totalMarks: Number,
    percent: Number,
    passed: Boolean,
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

testAttemptSchema.index({ test: 1, user: 1, attemptNo: 1 }, { unique: true });

export const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);
