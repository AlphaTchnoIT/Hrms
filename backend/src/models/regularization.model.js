import mongoose from 'mongoose';
import { REQUEST_STATUS } from '../constants/index.js';

// Request to fix a missed / wrong punch for a past day
const regularizationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    checkInTime: { type: String, required: true }, // "HH:mm"
    checkOutTime: { type: String, required: true }, // "HH:mm"
    reason: { type: String, required: [true, 'Reason is required'], trim: true },
    status: { type: String, enum: Object.values(REQUEST_STATUS), default: REQUEST_STATUS.PENDING },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: String,
  },
  { timestamps: true }
);

export const Regularization = mongoose.model('Regularization', regularizationSchema);
