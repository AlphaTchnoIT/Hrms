import mongoose from 'mongoose';
import { DEFAULT_UK_PAYROLL, DEFAULT_WORK_STATUSES, WORK_STATUS_CATEGORIES } from '../constants/index.js';

/*
 * Company-wide settings. Only one document exists in this collection.
 * Use Settings.getSettings() to read it (it is created with defaults on first use).
 */
const settingsSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: 'Acme Technologies Ltd' },
    companyEmail: String,
    companyPhone: String,
    companyAddress: String,
    timezone: { type: String, default: 'Europe/London' }, // all day / time logic and every screen use this
    currency: { type: String, default: 'GBP' }, // ISO code; all amounts on screen use it

    // Attendance
    officeStartTime: { type: String, default: '09:00' },
    officeEndTime: { type: String, default: '17:30' },
    graceMinutes: { type: Number, default: 15 },
    halfDayMinutes: { type: Number, default: 240 },
    fullDayMinutes: { type: Number, default: 480 },
    weeklyOffs: { type: [Number], default: [0, 6] }, // 0 = Sunday, 6 = Saturday
    requireLocationForCheckIn: { type: Boolean, default: false },

    // Modules that can be switched off (e.g. a company that runs payroll elsewhere or does not track status)
    features: {
      payroll: { type: Boolean, default: true },
      workStatus: { type: Boolean, default: true },
    },
    // UK GDPR
    privacyNoticeUrl: String,
    dataRetentionYears: { type: Number, default: 6, min: 1, max: 20 }, // leavers can be anonymised after this

    // Payroll: unpaid days (absences / unpaid leave) reduce pay; UK PAYE rates below
    attendanceBasedLop: { type: Boolean, default: true },
    payroll: {
      type: new mongoose.Schema(
        {
          taxYear: String,
          personalAllowance: Number,
          taxBands: [{ upTo: Number, rate: Number, _id: false }],
          scottishTaxBands: [{ upTo: Number, rate: Number, _id: false }],
          niPrimaryThreshold: Number,
          niUpperEarningsLimit: Number,
          niMainRate: Number,
          niUpperRate: Number,
          niSecondaryThreshold: Number,
          niEmployerRate: Number,
          pensionLowerLimit: Number,
          pensionUpperLimit: Number,
          pensionEmployeeRate: Number,
          pensionEmployerRate: Number,
          studentLoanThresholds: { plan1: Number, plan2: Number, plan4: Number, plan5: Number, postgrad: Number },
          studentLoanRate: Number,
          postgradLoanRate: Number,
          autoEnrolmentTrigger: Number,
          sspWeeklyRate: Number,
          statutoryFlatRate: Number,
          minimumWage: { age21: Number, age18: Number, under18: Number, apprentice: Number },
          mileageRate: Number,
          mileageRateAfter10k: Number,
        },
        { _id: false }
      ),
      default: () => structuredClone(DEFAULT_UK_PAYROLL),
    },

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

    // Live Work Status options employees pick from (key never changes, label / category can)
    workStatuses: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          category: { type: String, enum: WORK_STATUS_CATEGORIES, required: true },
          active: { type: Boolean, default: true },
          _id: false,
        },
      ],
      default: () => DEFAULT_WORK_STATUSES.map((s) => ({ ...s, active: true })),
    },
  },
  { timestamps: true }
);

settingsSchema.statics.getSettings = async function getSettings() {
  let settings = await this.findOne();
  if (!settings) settings = await this.create({});
  return settings;
};

export const Settings = mongoose.model('Settings', settingsSchema);
