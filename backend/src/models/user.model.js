import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, EMPLOYMENT_TYPES, EMPLOYEE_STATUS } from '../constants/index.js';

/*
 * User = Employee.
 * One document holds login details, personal info, job info and salary structure.
 */

const addressSchema = new mongoose.Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    pincode: String,
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  { name: String, relation: String, phone: String },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  { accountHolderName: String, accountNumber: String, bankName: String, ifsc: String },
  { _id: false }
);

// Monthly salary components (in INR)
const salarySchema = new mongoose.Schema(
  {
    basic: { type: Number, default: 0, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    conveyance: { type: Number, default: 0, min: 0 },
    specialAllowance: { type: Number, default: 0, min: 0 },
    otherAllowance: { type: Number, default: 0, min: 0 },
    pfApplicable: { type: Boolean, default: true },
    monthlyTds: { type: Number, default: 0, min: 0 },
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
    status: { type: String, enum: EMPLOYEE_STATUS, default: 'active' },
    exitDate: Date,

    // Finance
    panNumber: String,
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

userSchema.virtual('monthlyGross').get(function monthlyGross() {
  if (!this.salary) return 0;
  const { basic = 0, hra = 0, conveyance = 0, specialAllowance = 0, otherAllowance = 0 } = this.salary;
  return basic + hra + conveyance + specialAllowance + otherAllowance;
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

export const User = mongoose.model('User', userSchema);
