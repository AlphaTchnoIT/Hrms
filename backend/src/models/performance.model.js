import mongoose from 'mongoose';
import { ACTION_PLAN_STATUS, KPI_METRICS, KPI_PERIODS, RATING_REVIEW_STATUS } from '../constants/index.js';

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });

/*
 * A single KPI result (quality / efficiency / classification) for an employee.
 * Daily results use the actual date, weekly results use the Monday of that week.
 */
const kpiRecordSchema = new mongoose.Schema(
  {
    user: { ...ref('User'), required: true },
    metric: { type: String, enum: KPI_METRICS, required: true },
    period: { type: String, enum: KPI_PERIODS, default: 'daily' },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    score: { type: Number, required: true, min: 0, max: 100 },
    target: { type: Number, min: 0, max: 100 }, // target that applied when the score was recorded
    remarks: String,
    source: { type: String, enum: ['manual', 'qa-audit'], default: 'manual' },
    recordedBy: ref('User'),
  },
  { timestamps: true }
);

kpiRecordSchema.index({ user: 1, metric: 1, period: 1, date: 1 }, { unique: true });
kpiRecordSchema.index({ date: 1 });

export const KpiRecord = mongoose.model('KpiRecord', kpiRecordSchema);

/*
 * Action plan for an employee who is below target on a KPI.
 * baselineScore is captured at creation so the "forward performance" can be compared against it.
 */
const actionItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  isDone: { type: Boolean, default: false },
  doneAt: Date,
});

const checkInSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    note: { type: String, trim: true },
    score: Number,
    by: ref('User'),
  },
  { timestamps: true }
);

const actionPlanSchema = new mongoose.Schema(
  {
    user: { ...ref('User'), required: true },
    metric: { type: String, enum: [...KPI_METRICS, 'adherence'], required: true },
    title: { type: String, required: true, trim: true },
    reason: String,
    baselineScore: Number,
    targetScore: { type: Number, required: true, min: 0, max: 100 },
    startDate: { type: String, required: true },
    deadline: { type: String, required: true },
    followUpDate: String,
    actions: [actionItemSchema],
    checkIns: [checkInSchema],
    status: { type: String, enum: ACTION_PLAN_STATUS, default: 'open' },
    outcome: String,
    employeeAcknowledgedAt: Date,
    employeeComment: String,
    createdBy: ref('User'),
  },
  { timestamps: true }
);

actionPlanSchema.index({ user: 1, status: 1 });

export const ActionPlan = mongoose.model('ActionPlan', actionPlanSchema);

/*
 * Monthly 3-parameter rating (quality, efficiency, classification).
 * Needs mutual approval: QA signs off the quality side, HR signs off the overall rating.
 */
const approvalSchema = new mongoose.Schema(
  {
    by: ref('User'),
    at: Date,
    approved: Boolean,
    comment: String,
  },
  { _id: false }
);

const ratingReviewSchema = new mongoose.Schema(
  {
    user: { ...ref('User'), required: true },
    period: { type: String, required: true }, // "YYYY-MM"
    scores: {
      quality: Number,
      efficiency: Number,
      classification: Number,
      adherence: Number,
    },
    compositeScore: Number,
    systemRating: { type: Number, min: 1, max: 5 },
    finalRating: { type: Number, min: 1, max: 5 },
    managerComment: String,
    qaApproval: { type: approvalSchema, default: () => ({}) },
    hrApproval: { type: approvalSchema, default: () => ({}) },
    status: { type: String, enum: RATING_REVIEW_STATUS, default: 'pending-approval' },
    employeeAcknowledgedAt: Date,
    generatedBy: ref('User'),
  },
  { timestamps: true }
);

ratingReviewSchema.index({ user: 1, period: 1 }, { unique: true });

export const RatingReview = mongoose.model('RatingReview', ratingReviewSchema);
