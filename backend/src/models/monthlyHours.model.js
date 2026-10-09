import mongoose from 'mongoose';

/*
 * AT (productive) hours of one employee for a whole month, entered once by the manager / HR.
 * Hourly payroll uses this when present; otherwise the sum of the daily AT hours.
 */
const monthlyHoursSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    productiveMinutes: { type: Number, required: true, min: 0 },
    note: String,
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

monthlyHoursSchema.index({ user: 1, year: 1, month: 1 }, { unique: true });
monthlyHoursSchema.index({ year: 1, month: 1 });

export const MonthlyHours = mongoose.model('MonthlyHours', monthlyHoursSchema);
