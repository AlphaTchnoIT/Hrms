import mongoose from 'mongoose';
import {
  APPLICATION_STATUS,
  DOCUMENT_STATUS,
  EMPLOYMENT_TYPES,
  INTERVIEW_MODES,
  INTERVIEW_RESULTS,
  JOB_STATUS,
} from '../constants/index.js';

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });

const jobPostingSchema = new mongoose.Schema(
  {
    refNo: { type: String, unique: true },
    title: { type: String, required: true, trim: true },
    department: ref('Department'),
    designation: ref('Designation'),
    location: String,
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'full-time' },
    description: { type: String, required: true },
    requirements: String,
    openings: { type: Number, default: 1, min: 1 },
    isInternal: { type: Boolean, default: true }, // visible to employees in "Internal Jobs"
    minTenureMonths: { type: Number, default: 0, min: 0 }, // eligibility for internal applicants
    blockOnFinalWarning: { type: Boolean, default: true }, // stage 3+ active warning = not eligible
    closingDate: String,
    status: { type: String, enum: JOB_STATUS, default: 'open' },
    createdBy: ref('User'),
  },
  { timestamps: true }
);

export const JobPosting = mongoose.model('JobPosting', jobPostingSchema);

const interviewSchema = new mongoose.Schema(
  {
    round: { type: String, default: 'Round 1' },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 45 },
    mode: { type: String, enum: INTERVIEW_MODES, default: 'video' },
    location: String, // room or meeting link
    interviewers: [ref('User')],
    result: { type: String, enum: INTERVIEW_RESULTS, default: 'pending' },
    feedback: String,
    reminderSentAt: Date, // email reminder to an external candidate
  },
  { timestamps: true }
);

const documentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: DOCUMENT_STATUS, default: 'requested' },
    url: String,
    note: String,
    requestedAt: { type: Date, default: Date.now },
    submittedAt: Date,
  },
  { timestamps: false }
);

const statusHistorySchema = new mongoose.Schema(
  { status: String, note: String, by: ref('User'), at: { type: Date, default: Date.now } },
  { _id: false }
);

/*
 * An application from an internal employee (applicant set) or an external candidate (candidate set).
 * External candidates track status on the public page with refNo + email.
 */
const applicationSchema = new mongoose.Schema(
  {
    refNo: { type: String, unique: true },
    job: { ...ref('JobPosting'), required: true },
    applicant: ref('User'),
    candidate: {
      name: String,
      email: { type: String, lowercase: true, trim: true },
      phone: String,
    },
    resumeUrl: String,
    coverNote: String,
    source: { type: String, enum: ['internal', 'external', 'referral'], default: 'internal' },
    status: { type: String, enum: APPLICATION_STATUS, default: 'received' },
    statusHistory: [statusHistorySchema],
    interviews: [interviewSchema],
    documents: [documentSchema],
    hrNotes: String,
  },
  { timestamps: true }
);

applicationSchema.index({ job: 1, applicant: 1 });

export const Application = mongoose.model('Application', applicationSchema);
