import mongoose from 'mongoose';
import { WORK_STATUS_CATEGORIES } from '../constants/index.js';

/*
 * One row per status an employee was in: "Email handling from 10:05 to 11:20".
 * The current status is the row with endedAt = null. Label and category are copied
 * so old rows stay correct if the admin renames or removes a status later.
 */
const workStatusLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" in company timezone
    status: { type: String, required: true },
    label: { type: String, required: true },
    category: { type: String, enum: WORK_STATUS_CATEGORIES, required: true },
    note: { type: String, trim: true, maxlength: 120 },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    endReason: { type: String, enum: ['changed', 'check-out', 'auto-closed'] },
  },
  { timestamps: true }
);

workStatusLogSchema.index({ user: 1, date: 1, startedAt: 1 });
workStatusLogSchema.index({ endedAt: 1, date: 1 });

export const WorkStatusLog = mongoose.model('WorkStatusLog', workStatusLogSchema);
