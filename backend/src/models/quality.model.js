import mongoose from 'mongoose';
import { CALIBRATION_STATUS, INTERACTION_CHANNELS, QA_ERROR_CATEGORIES } from '../constants/index.js';

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });

// A resolved customer interaction (call / chat / email). Used as the pool for calibration.
const interactionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true, trim: true },
    agent: { ...ref('User'), required: true },
    channel: { type: String, enum: INTERACTION_CHANNELS, default: 'call' },
    customerName: String,
    summary: String,
    recordingUrl: String,
    resolvedAt: { type: Date, required: true },
    createdBy: ref('User'),
  },
  { timestamps: true }
);

interactionSchema.index({ resolvedAt: -1 });

export const Interaction = mongoose.model('Interaction', interactionSchema);

// QA audit result recorded against an employee, which the employee must acknowledge
const qaFeedbackSchema = new mongoose.Schema(
  {
    user: { ...ref('User'), required: true },
    auditor: { ...ref('User'), required: true },
    interaction: ref('Interaction'),
    interactionRef: String,
    auditDate: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    isFatal: { type: Boolean, default: false },
    errorCategories: [{ type: String, enum: QA_ERROR_CATEGORIES }],
    strengths: String,
    improvements: String,
    comments: String,
    acknowledgedAt: Date,
    employeeComment: String,
  },
  { timestamps: true }
);

qaFeedbackSchema.index({ user: 1, auditDate: -1 });

export const QaFeedback = mongoose.model('QaFeedback', qaFeedbackSchema);

/*
 * Calibration: the same interaction is audited independently by a manager and a QA auditor.
 * Scores stay hidden from the other side until both are in. Then both sides approve an agreed score.
 */
const auditSchema = new mongoose.Schema(
  {
    auditor: ref('User'),
    score: { type: Number, min: 0, max: 100 },
    notes: String,
    at: Date,
  },
  { _id: false }
);

const signOffSchema = new mongoose.Schema(
  { by: ref('User'), at: Date, comment: String },
  { _id: false }
);

const calibrationSchema = new mongoose.Schema(
  {
    interaction: { ...ref('Interaction'), required: true },
    frequency: { type: String, enum: ['daily', 'weekly'], default: 'weekly' },
    managerAudit: { type: auditSchema, default: () => ({}) },
    qaAudit: { type: auditSchema, default: () => ({}) },
    variance: Number,
    accuracy: Number, // 100 - variance
    isAligned: Boolean,
    agreedScore: Number,
    managerSignOff: signOffSchema,
    qaSignOff: signOffSchema,
    status: { type: String, enum: CALIBRATION_STATUS, default: 'pending' },
    selectedBy: ref('User'),
  },
  { timestamps: true }
);

export const Calibration = mongoose.model('Calibration', calibrationSchema);
