import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../constants/index.js';

const leaveRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    fromDate: { type: String, required: true }, // "YYYY-MM-DD"
    toDate: { type: String, required: true },
    isHalfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: ['first-half', 'second-half', null], default: null },
    days: { type: Number, required: true },
    reason: { type: String, required: [true, 'Reason is required'], trim: true },
    status: { type: String, enum: Object.values(REQUEST_STATUS), default: REQUEST_STATUS.PENDING },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: String,
  },
  { timestamps: true }
);

leaveRequestSchema.index({ user: 1, fromDate: 1 });
leaveRequestSchema.index({ status: 1 });

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
