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

    // Performance (configurable KPI thresholds)
    kpiTargets: {
      quality: { type: Number, default: 90 },
      efficiency: { type: Number, default: 85 },
      classification: { type: Number, default: 95 },
      adherence: { type: Number, default: 90 },
    },
    // Weightage of the 3 rating parameters (should add up to 100)
    kpiWeights: {
      quality: { type: Number, default: 40 },
      efficiency: { type: Number, default: 35 },
      classification: { type: Number, default: 25 },
    },
    // Score within this many points below target = Needs Attention, further below = Critical
    attentionBand: { type: Number, default: 5 },
    // Ramp-up efficiency targets for new joiners: up to `week` weeks of tenure the target is `target`
    efficiencyGlidePath: {
      type: [{ week: Number, target: Number, _id: false }],
      default: [
        { week: 4, target: 60 },
        { week: 8, target: 70 },
        { week: 12, target: 80 },
      ],
    },
    // Login shorter than this % of the scheduled shift = short login
    shortLoginPercent: { type: Number, default: 90 },
    // Idle minutes above this in a day are flagged
    idleAlertMinutes: { type: Number, default: 60 },
    // Calibration: manager vs QA score difference allowed to count as aligned
    calibrationTolerance: { type: Number, default: 5 },
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function getSettings() {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

export const Settings = mongoose.model('Settings', settingsSchema);
