import mongoose from 'mongoose';

/*
 * One roster entry = an employee's shift (or weekly off) on one date.
 * Days without an entry fall back to the company office timings / weekly offs from Settings.
 */
const rosterSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    shiftName: { type: String, trim: true, default: 'General' },
    startTime: { type: String, default: '09:30' }, // "HH:mm"
    endTime: { type: String, default: '18:30' }, // may be earlier than start for night shifts
    isWeeklyOff: { type: Boolean, default: false },
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

rosterSchema.index({ user: 1, date: 1 }, { unique: true });
rosterSchema.index({ date: 1 });

export const Roster = mongoose.model('Roster', rosterSchema);
