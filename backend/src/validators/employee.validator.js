import { z } from 'zod';
import { EMPLOYEE_STATUS, EMPLOYMENT_TYPES, HOLIDAY_REGIONS, NI_CATEGORIES, RIGHT_TO_WORK_STATUS, ROLES, STUDENT_LOAN_PLANS } from '../constants/index.js';
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
  postcode,
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
  city: optionalText('Town / city', 60),
  county: optionalText('County', 60),
  country: optionalText('Country', 60),
  postcode: optional(postcode),
});

export const emergencyContactSchema = z.object({
  name: optional(personName('Contact name')),
  relation: optionalText('Relation', 30),
  phone: optional(phone),
});

const bankDetailsSchema = z.object({
  accountHolderName: optionalText('Account holder name', 80),
  bankName: optionalText('Bank name', 80),
  accountNumber: optional(z.string().trim().regex(/^\d{8}$/, 'UK account number must be 8 digits')),
  // "12-34-56", "12 34 56" or "123456" -> "12-34-56"
  sortCode: optional(
    z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s-]/g, ''))
      .refine((v) => /^\d{6}$/.test(v), 'Sort code must be 6 digits (e.g. 12-34-56)')
      .transform((v) => `${v.slice(0, 2)}-${v.slice(2, 4)}-${v.slice(4)}`)
  ),
});

// HMRC tax codes: 1257L, S1257L (Scotland), C1257L (Wales), K475, BR, D0, D1, 0T, NT (+ optional W1 / M1 / X)
export const TAX_CODE_REGEX = /^[SC]?(?:\d{1,4}[LMNT]|K\d{1,4}|BR|D0|D1|0T|NT)(?: ?(?:W1|M1|X))?$/;

const salarySchema = z.object({
  annualSalary: money('Annual salary', { max: 10000000 }),
  monthlyAllowance: money('Monthly allowance'),
  taxCode: optional(z.string().trim().toUpperCase().regex(TAX_CODE_REGEX, 'Enter a valid tax code (e.g. 1257L)')),
  niCategory: z.enum(NI_CATEGORIES, { errorMap: () => ({ message: 'Select an NI category' }) }).optional(),
  pensionEnrolled: z.boolean().optional(),
  studentLoanPlan: z.enum(STUDENT_LOAN_PLANS).optional(),
  postgraduateLoan: z.boolean().optional(),
  pensionOptedOutOn: optionalDate('Pension opt-out date'),
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
  holidayRegion: z.enum(HOLIDAY_REGIONS, { errorMap: () => ({ message: 'Select a bank holiday region' }) }).optional(),
  workingDaysPerWeek: z.coerce.number().min(0.5, 'At least half a day a week').max(7, 'At most 7 days a week').optional(),
  contractedHoursPerWeek: z.coerce.number().min(1, 'At least 1 hour a week').max(80, 'At most 80 hours a week').optional(),
  noticePeriodWeeks: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.coerce.number().min(0).max(52, 'At most 52 weeks').optional()),
  wtrOptOut: z.boolean().optional(),
  probationEndDate: optionalDate('Probation end date'),
  rightToWork: z
    .object({
      status: z.enum(RIGHT_TO_WORK_STATUS).optional(),
      documentType: optionalText('Document', 80),
      shareCode: optional(z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3} ?[A-Z0-9]{3} ?[A-Z0-9]{3}$/, 'Share code is 9 characters (e.g. W12 3AB 45C)')),
      checkedOn: optionalDate('Check date'),
      expiryDate: optionalDate('Permission expiry date'),
    })
    .refine((r) => r.status !== 'time-limited' || r.expiryDate, { path: ['expiryDate'], message: 'Time-limited permission needs an expiry date' })
    .optional(),
  // National Insurance number, e.g. "QQ 12 34 56 C" (spaces are removed)
  niNumber: optional(
    z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => v.replace(/\s/g, ''))
      .refine((v) => /^(?!BG|GB|KN|NK|NT|TN|ZZ)[A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z]\d{6}[A-D]$/.test(v) || /^QQ\d{6}[A-D]$/.test(v), 'Enter a valid National Insurance number (e.g. QQ 12 34 56 C)')
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

