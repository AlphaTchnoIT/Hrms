import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Leave type name is required'], unique: true, trim: true },
    code: { type: String, required: [true, 'Code is required'], unique: true, uppercase: true, trim: true },
    annualQuota: { type: Number, default: 0, min: 0 },
    isPaid: { type: Boolean, default: true }, // unpaid leave reduces pay and needs no balance
    // UK holiday: pro-rated for part-time staff (working days / 5) and for joiners / leavers during the year
    proRata: { type: Boolean, default: false },
    carryForwardMax: { type: Number, default: 0, min: 0 }, // unused days that move into next year
    allowHalfDay: { type: Boolean, default: true },
    color: { type: String, default: '#6366f1' },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LeaveType = mongoose.model('LeaveType', leaveTypeSchema);
