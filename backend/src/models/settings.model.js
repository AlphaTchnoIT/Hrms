import mongoose from 'mongoose';

/*
 * Company-wide settings. Only one document exists in this collection.
 * Use Settings.getSettings() to read it (it is created with defaults on first use).
 */
const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'Acme Technologies Pvt Ltd' },
    companyEmail: String,
    companyPhone: String,
    companyAddress: String,
    timezone: { type: String, default: 'Asia/Kolkata' },
    currency: { type: String, default: 'INR' },

    // Attendance
    officeStartTime: { type: String, default: '09:30' },
    officeEndTime: { type: String, default: '18:30' },
    graceMinutes: { type: Number, default: 15 },
    halfDayMinutes: { type: Number, default: 240 },
    fullDayMinutes: { type: Number, default: 480 },
    weeklyOffs: { type: [Number], default: [0, 6] }, // 0 = Sunday, 6 = Saturday
    requireLocationForCheckIn: { type: Boolean, default: false },

    // Payroll
    pfRate: { type: Number, default: 12 },
    pfCeiling: { type: Number, default: 1800 }, // max PF per month (0 = no cap)
    professionalTax: { type: Number, default: 200 },
    attendanceBasedLop: { type: Boolean, default: true },
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function getSettings() {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

export const Settings = mongoose.model('Settings', settingsSchema);
