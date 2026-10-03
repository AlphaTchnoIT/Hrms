import mongoose from 'mongoose';
import { ATTENDANCE_STATUS } from '../constants/index.js';

const punchSchema = new mongoose.Schema(
  {
    time: Date,
    ip: String,
    userAgent: String,
    location: { latitude: Number, longitude: Number },
    note: String,
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD" in company timezone
    checkIn: punchSchema,
    checkOut: punchSchema,
    workMinutes: { type: Number, default: 0 },
    status: { type: String, enum: ATTENDANCE_STATUS, default: 'present' },
    isLate: { type: Boolean, default: false },
    lateByMinutes: { type: Number, default: 0 },
    source: { type: String, enum: ['web', 'regularization', 'manual'], default: 'web' },
    remarks: String,
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
