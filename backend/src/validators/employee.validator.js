import { z } from 'zod';
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, ROLES } from '../constants/index.js';
import {
  dateStr,
  email,
  money,
  optional,
  optionalDate,
  optionalObjectId,
  optionalText,
  password,
  personName,
  phone,
  today,
  url,
} from './common.js';

const GENDERS = ['male', 'female', 'other'];
const MARITAL_STATUS = ['single', 'married', 'divorced', 'widowed'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const yearsBetween = (from, to) => (new Date(to) - new Date(from)) / (365.25 * 24 * 3600 * 1000);

const dateOfBirth = optionalDate('Date of birth').refine(
  (v) => !v || (yearsBetween(v, today()) >= 18 && yearsBetween(v, today()) <= 80),
  'Employee must be between 18 and 80 years old'
);

export const addressSchema = z.object({
  line1: optionalText('Address line 1', 150),
  line2: optionalText('Address line 2', 150),
  city: optionalText('City', 60),
  state: optionalText('State', 60),
  country: optionalText('Country', 60),
  pincode: optional(z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits')),
});

export const emergencyContactSchema = z.object({
  name: optional(personName('Contact name')),
  relation: optionalText('Relation', 30),
  phone: optional(phone),
});

const bankDetailsSchema = z.object({
  accountHolderName: optionalText('Account holder name', 80),
  bankName: optionalText('Bank name', 80),
  accountNumber: optional(z.string().trim().regex(/^\d{9,18}$/, 'Account number must be 9 to 18 digits')),
  ifsc: optional(
    z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC code (e.g. HDFC0001234)')
  ),
});

const salarySchema = z.object({
  basic: money('Basic'),
  hra: money('HRA'),
  conveyance: money('Conveyance'),
  specialAllowance: money('Special allowance'),
  otherAllowance: money('Other allowance'),
  monthlyTds: money('Monthly TDS'),
  pfApplicable: z.boolean().optional(),
});

// Personal fields an employee can edit on their own profile
export const personalInfoSchema = z.object({
  phone: optional(phone),
  gender: optional(z.enum(GENDERS, { errorMap: () => ({ message: 'Select a valid gender' }) })),
  dateOfBirth,
  maritalStatus: optional(z.enum(MARITAL_STATUS)),
  bloodGroup: optional(z.enum(BLOOD_GROUPS, { errorMap: () => ({ message: 'Select a valid blood group' }) })),
  avatar: optional(url('Photo URL')),
  address: addressSchema.optional(),
  emergencyContact: emergencyContactSchema.optional(),
});

const employeeFields = personalInfoSchema.extend({
  firstName: personName('First name'),
  lastName: optional(personName('Last name')),
  email,
  role: z.enum(Object.values(ROLES), { errorMap: () => ({ message: 'Select a valid role' }) }),
  status: z.enum(EMPLOYEE_STATUS).optional(),
  department: optionalObjectId('department'),
  designation: optionalObjectId('designation'),
  reportingManager: optionalObjectId('reporting manager'),
  employmentType: z.enum(EMPLOYMENT_TYPES, { errorMap: () => ({ message: 'Select an employment type' }) }),
  dateOfJoining: dateStr('Date of joining'),
  exitDate: optionalDate('Exit date'),
  workLocation: optionalText('Work location', 100),
  panNumber: optional(
    z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN (e.g. ABCDE1234F)')
  ),
  bankDetails: bankDetailsSchema.optional(),
  salary: salarySchema.optional(),
});

function checkDates(data, ctx) {
  if (data.dateOfJoining && data.dateOfJoining > new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)) {
    ctx.addIssue({ code: 'custom', path: ['dateOfJoining'], message: 'Joining date cannot be more than 6 months ahead' });
  }
  if (data.dateOfBirth && data.dateOfJoining && yearsBetween(data.dateOfBirth, data.dateOfJoining) < 18) {
    ctx.addIssue({ code: 'custom', path: ['dateOfJoining'], message: 'Employee must be at least 18 on the joining date' });
  }
  if (data.exitDate && data.dateOfJoining && data.exitDate < data.dateOfJoining) {
    ctx.addIssue({ code: 'custom', path: ['exitDate'], message: 'Exit date cannot be before joining date' });
  }
}

export const createEmployeeSchema = employeeFields
  .extend({ password: optional(password) })
  .superRefine(checkDates);

export const updateEmployeeSchema = employeeFields.partial().superRefine(checkDates);

export const resetPasswordSchema = z.object({ newPassword: password });

