import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, EMPLOYMENT_TYPES, EMPLOYEE_STATUS, HOLIDAY_REGIONS, NI_CATEGORIES, RIGHT_TO_WORK_STATUS, STUDENT_LOAN_PLANS, PAY_TYPES, DEDUCTION_MODES } from '../constants/index.js';
import { annualPay } from '../utils/pay.js';

/*
 * User = Employee.
 * One document holds login details, personal info, job info and salary structure.
 */

const addressSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    city: String,
    county: String,
    country: { type: String, default: 'United Kingdom' },
    postcode: String,
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  { name: String, relation: String, phone: String },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  { accountHolderName: String, accountNumber: String, bankName: String, sortCode: String },
  { _id: false }
);

/*
 * Pay details for UK payroll (PAYE). Amounts are in the company currency.
 * Salaried: monthly gross = annual salary / 12 + monthly allowance.
 * Hourly: monthly gross = hourly rate x AT (productive) hours of the month + monthly allowance.
 */
const salarySchema = new mongoose.Schema(
  {
    payType: { type: String, enum: PAY_TYPES, default: 'salaried' },
    annualSalary: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, default: 0, min: 0 },
    // auto: PAYE tax, NI, pension and student loans are worked out; manual: the legal / payroll team adds them outside the app
    deductionMode: { type: String, enum: DEDUCTION_MODES, default: 'auto' },
    monthlyAllowance: { type: Number, default: 0, min: 0 }, // e.g. London weighting, car allowance
    taxCode: { type: String, default: '1257L', uppercase: true, trim: true },
    niCategory: { type: String, enum: NI_CATEGORIES, default: 'A' },
    pensionEnrolled: { type: Boolean, default: true }, // workplace pension (auto-enrolment)
    studentLoanPlan: { type: String, enum: STUDENT_LOAN_PLANS, default: 'none' },
    postgraduateLoan: { type: Boolean, default: false },
    pensionOptedOutOn: String, // "YYYY-MM-DD": the worker opted out of the workplace pension
  },
  { _id: false }
);

// Right to work check (Home Office). shareCode is for online checks; expiryDate only for time-limited permission
const rightToWorkSchema = new mongoose.Schema(
  {
    status: { type: String, enum: RIGHT_TO_WORK_STATUS, default: 'not-checked' },
    documentType: String, // e.g. "UK passport", "eVisa / share code", "BRP"
    shareCode: String,
    checkedOn: String, // "YYYY-MM-DD"
    expiryDate: String, // "YYYY-MM-DD"
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, unique: true, sparse: true },
    firstName: { type: String, required: [true, 'First name is required'], trim: true },
    lastName: { type: String, trim: true, default: '' },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    // Set when HR creates the account or resets the password: the user must pick their own password first
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: Date, // tokens issued before this are rejected
    passwordResetToken: { type: String, select: false }, // sha256 of the emailed token
    passwordResetExpires: { type: Date, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.EMPLOYEE },

    // Personal
    phone: { type: String, trim: true },
    gender: String,
    dateOfBirth: Date,
    maritalStatus: String,
    bloodGroup: String,
    avatar: String,
    address: { type: addressSchema, default: () => ({}) },
    emergencyContact: { type: emergencyContactSchema, default: () => ({}) },

    // Job
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'full-time' },
    dateOfJoining: { type: Date, default: Date.now },
    workLocation: String,
    holidayRegion: { type: String, enum: HOLIDAY_REGIONS, default: 'england-wales' }, // which bank holidays apply
    workingDaysPerWeek: { type: Number, default: 5, min: 0.5, max: 7 }, // part-time holiday is pro-rated on this
    contractedHoursPerWeek: { type: Number, default: 37.5, min: 1, max: 80 }, // for the minimum wage check
    noticePeriodWeeks: { type: Number, min: 0, max: 52 }, // contractual notice; never below the statutory minimum
    wtrOptOut: { type: Boolean, default: false }, // signed opt-out of the 48-hour average working week
    probationEndDate: String, // "YYYY-MM-DD"
    rightToWork: { type: rightToWorkSchema, default: () => ({}) },
    anonymisedAt: Date, // personal data removed after the retention period (UK GDPR)
    status: { type: String, enum: EMPLOYEE_STATUS, default: 'active' },
    exitDate: Date,

    // Finance
    niNumber: { type: String, uppercase: true, trim: true }, // National Insurance number
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
    salary: { type: salarySchema, default: () => ({}) },

    lastLoginAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName || ''} ${this.lastName || ''}`.trim();
});

// Hourly workers: an estimate on contracted hours (actual pay depends on hours worked)
userSchema.virtual('monthlyGross').get(function monthlyGross() {
  if (!this.salary) return 0;
  return Math.round((annualPay(this.salary, this.contractedHoursPerWeek) / 12) * 100) / 100;
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
  // A second earlier so a token issued right after the change is still valid
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

export const User = mongoose.model('User', userSchema);
