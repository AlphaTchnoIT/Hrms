import mongoose from 'mongoose';
import {
  ESCALATION_STATUS,
  KPI_METRICS,
  TRIGGER_TYPES,
  WARNING_CATEGORIES,
  WARNING_STATUS,
} from '../constants/index.js';

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });

// Audit trail entry kept inside escalations and warnings
const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    note: String,
    by: ref('User'),
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const escalationSchema = new mongoose.Schema(
  {
    refNo: { type: String, unique: true },
    employee: { ...ref('User'), required: true },
    raisedBy: { ...ref('User'), required: true },
    category: { type: String, enum: WARNING_CATEGORIES, required: true },
    incident: { type: String, required: true, trim: true },
    incidentDate: { type: String, required: true },
    evidence: String,
    expectations: String,
    followUpDate: String,
    status: { type: String, enum: ESCALATION_STATUS, default: 'open' },
    outcome: String,
    history: [historySchema],
  },
  { timestamps: true }
);

escalationSchema.index({ employee: 1, createdAt: -1 });

export const Escalation = mongoose.model('Escalation', escalationSchema);

const warningSchema = new mongoose.Schema(
  {
    refNo: { type: String, unique: true },
    employee: { ...ref('User'), required: true },
    issuedBy: { ...ref('User'), required: true },
    category: { type: String, enum: WARNING_CATEGORIES, required: true },
    stage: { type: Number, min: 1, max: 4, required: true },
    reason: { type: String, required: true, trim: true },
    details: String,
    expectations: String,
    issuedDate: { type: String, required: true },
    expiresOn: String, // the warning stops counting towards the next stage after this date
    escalation: ref('Escalation'),
    status: { type: String, enum: WARNING_STATUS, default: 'issued' },
    acknowledgedAt: Date,
    employeeComment: String,
    history: [historySchema],
  },
  { timestamps: true }
);

warningSchema.index({ employee: 1, category: 1, status: 1 });

export const Warning = mongoose.model('Warning', warningSchema);

/*
 * Configurable rule that flags employees for manager review, e.g.
 * "3 or more late logins in 30 days" or "efficiency below target 5 times in 14 days".
 */
const warningTriggerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: TRIGGER_TYPES, required: true },
    metric: { type: String, enum: [...KPI_METRICS, null], default: null }, // for kpi-failure
    threshold: { type: Number, required: true, min: 1 },
    windowDays: { type: Number, required: true, min: 1, max: 365 },
    category: { type: String, enum: WARNING_CATEGORIES, default: 'performance' }, // suggested warning category
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const WarningTrigger = mongoose.model('WarningTrigger', warningTriggerSchema);
