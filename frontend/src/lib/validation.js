import { z } from 'zod';

/*
 * Form validation schemas (same rules as the backend validators).
 * Used with useForm(initialValues, { schema }) to show errors under each field.
 */

/* ------------------------------- building blocks ------------------------------- */

const optional = (schema) => schema.optional().or(z.literal(''));

const required = (label, { min = 1, max = 200 } = {}) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

const text = (label, max = 500) => optional(z.string().trim().max(max, `${label} must be at most ${max} characters`));

const personName = (label) =>
  required(label, { max: 50 }).regex(/^[A-Za-z][A-Za-z\s.'-]*$/, `${label} can contain only letters`);

const select = (label) => z.string({ required_error: `Please select ${label}` }).min(1, `Please select ${label}`);

const date = (label) => z.string({ required_error: `${label} is required` }).min(1, `${label} is required`);

const time = (label) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${label} is required`);

export const emailRule = z.string().trim().min(1, 'Email is required').email('Enter a valid email address');
// Spaces and dashes are ignored: "98765 43210" and "+91-9876543210" are both valid
const phoneRule = z
  .string()
  .trim()
  .refine((v) => /^(\+91)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, '')), 'Enter a valid 10-digit mobile number');
const urlRule = (label) => z.string().trim().url(`Enter a valid ${label} (https://...)`);

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password must be at most 64 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

// Number input (string) -> number with friendly messages
const number = (label, { min = 0, max = 10000000, int = false, required: isRequired = false } = {}) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? (isRequired ? undefined : 0) : Number(v)),
    z
      .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
      .refine((v) => !int || Number.isInteger(v), `${label} must be a whole number`)
      .refine((v) => v >= min, `${label} must be at least ${min}`)
      .refine((v) => v <= max, `${label} must be at most ${max}`)
  );

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const yearsBetween = (from, to) => (new Date(to) - new Date(from)) / (365.25 * 24 * 3600 * 1000);

/* ------------------------------- auth / profile ------------------------------- */

export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordRule,
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current one',
  })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const resetPasswordSchema = z.object({ newPassword: passwordRule });

const addressSchema = z.object({
  line1: text('Address line 1', 150),
  line2: text('Address line 2', 150),
  city: text('City', 60),
  state: text('State', 60),
  country: text('Country', 60),
  pincode: optional(z.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits')),
});

const emergencySchema = z.object({
  name: optional(personName('Contact name')),
  relation: text('Relation', 30),
  phone: optional(phoneRule),
});

const dobRule = z
  .string()
  .optional()
  .refine((v) => !v || v <= todayStr(), 'Date of birth cannot be in the future')
  .refine((v) => !v || (yearsBetween(v, todayStr()) >= 18 && yearsBetween(v, todayStr()) <= 80), 'Must be between 18 and 80 years old');

export const personalInfoSchema = z.object({
  phone: optional(phoneRule),
  dateOfBirth: dobRule,
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  bloodGroup: z.string().optional(),
  avatar: optional(urlRule('photo URL')),
  address: addressSchema,
  emergencyContact: emergencySchema,
});

/* ------------------------------- employees ------------------------------- */

const employeeBase = z.object({
  firstName: personName('First name'),
  lastName: optional(personName('Last name')),
  email: emailRule,
  phone: optional(phoneRule),
  password: optional(passwordRule),
  role: select('a role'),
  status: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
  reportingManager: z.string().optional(),
  employmentType: select('an employment type'),
  dateOfJoining: date('Date of joining'),
  workLocation: text('Work location', 100),
  gender: z.string().optional(),
  dateOfBirth: dobRule,
  maritalStatus: z.string().optional(),
  bloodGroup: z.string().optional(),
  panNumber: optional(z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN (e.g. ABCDE1234F)')),
  bankDetails: z.object({
    accountHolderName: text('Account holder name', 80),
    bankName: text('Bank name', 80),
    accountNumber: optional(z.string().trim().regex(/^\d{9,18}$/, 'Account number must be 9 to 18 digits')),
    ifsc: optional(z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Enter a valid IFSC (e.g. HDFC0001234)')),
  }),
  salary: z.object({
    basic: number('Basic'),
    hra: number('HRA'),
    conveyance: number('Conveyance'),
    specialAllowance: number('Special allowance'),
    otherAllowance: number('Other allowance'),
    monthlyTds: number('Monthly TDS'),
    pfApplicable: z.boolean(),
  }),
});

export const employeeSchema = employeeBase.superRefine((d, ctx) => {
  if (d.dateOfBirth && d.dateOfJoining && yearsBetween(d.dateOfBirth, d.dateOfJoining) < 18) {
    ctx.addIssue({ code: 'custom', path: ['dateOfJoining'], message: 'Employee must be at least 18 on the joining date' });
  }
  const gross = d.salary.basic + d.salary.hra + d.salary.conveyance + d.salary.specialAllowance + d.salary.otherAllowance;
  if (d.salary.monthlyTds > gross) {
    ctx.addIssue({ code: 'custom', path: ['salary.monthlyTds'], message: 'TDS cannot be more than gross salary' });
  }
  if (d.salary.hra > 0 && d.salary.basic === 0) {
    ctx.addIssue({ code: 'custom', path: ['salary.basic'], message: 'Basic salary is required when HRA is set' });
  }
});

/* ------------------------------- attendance & leave ------------------------------- */

export const regularizationSchema = z
  .object({
    date: date('Date').refine((v) => v <= todayStr(), 'Date cannot be in the future'),
    checkInTime: time('Check-in time'),
    checkOutTime: time('Check-out time'),
    reason: required('Reason', { min: 5, max: 300 }),
  })
  .refine((d) => d.checkOutTime > d.checkInTime, { path: ['checkOutTime'], message: 'Check-out must be after check-in' });

export const applyLeaveSchema = z
  .object({
    leaveType: select('a leave type'),
    fromDate: date('From date'),
    toDate: z.string().optional(),
    isHalfDay: z.boolean(),
    halfDaySession: z.string().optional(),
    reason: required('Reason', { min: 5, max: 500 }),
  })
  .superRefine((d, ctx) => {
    if (d.isHalfDay) return;
    if (!d.toDate) ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'To date is required' });
    else if (d.toDate < d.fromDate) ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'To date cannot be before From date' });
    else if (d.toDate.slice(0, 4) !== d.fromDate.slice(0, 4)) {
      ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'Apply separately for each calendar year' });
    }
  });

export const leaveTypeSchema = z.object({
  name: required('Leave type name', { min: 2, max: 50 }),
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,6}$/, 'Code must be 2-6 letters (e.g. CL)'),
  annualQuota: number('Days per year', { max: 365 }).refine((v) => Number.isInteger(v * 2), 'Use whole or half days'),
  isPaid: z.boolean(),
  allowHalfDay: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour'),
  description: text('Description', 300),
  isActive: z.boolean(),
});

export const leaveAllocationSchema = z.object({
  allocated: number('Allocated days', { max: 365, required: true }).refine((v) => Number.isInteger(v * 2), 'Use whole or half days'),
});

/* ------------------------------- requests ------------------------------- */

export const reviewSchema = (action) =>
  z.object({
    note:
      action === 'reject'
        ? required('Reason for rejection', { min: 3, max: 500 })
        : text('Note', 500),
  });

export const expenseSchema = z.object({
  title: required('Title', { min: 3, max: 100 }),
  category: select('a category'),
  amount: number('Amount', { max: 500000, required: true }).refine((v) => v > 0, 'Amount must be greater than 0'),
  expenseDate: date('Expense date').refine((v) => v <= todayStr(), 'Expense date cannot be in the future'),
  description: text('Description', 500),
  receiptUrl: optional(urlRule('receipt link')),
});

export const goalSchema = z
  .object({
    user: z.string().optional(),
    title: required('Goal title', { min: 3, max: 150 }),
    description: text('Description', 1000),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    weightage: number('Weightage', { max: 100, int: true }),
    progress: number('Progress', { max: 100, int: true }),
    status: z.string(),
    selfRating: z.string().optional(),
    selfComment: text('Self comment', 500),
    managerRating: z.string().optional(),
    managerComment: text('Manager comment', 500),
  })
  .refine((d) => !d.startDate || !d.dueDate || d.dueDate >= d.startDate, {
    path: ['dueDate'],
    message: 'Due date cannot be before start date',
  });

export const teamGoalSchema = goalSchema.refine((d) => Boolean(d.user), { path: ['user'], message: 'Please select an employee' });

/* ------------------------------- company ------------------------------- */

export const departmentSchema = z.object({
  name: required('Department name', { min: 2, max: 60 }),
  code: optional(z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/, 'Code must be 2-10 letters or numbers')),
  description: text('Description', 300),
  head: z.string().optional(),
  isActive: z.boolean(),
});

export const designationSchema = z.object({
  title: required('Designation title', { min: 2, max: 60 }),
  level: number('Level', { min: 1, max: 20, int: true, required: true }),
  description: text('Description', 300),
  isActive: z.boolean(),
});

export const holidaySchema = z.object({
  name: required('Holiday name', { min: 2, max: 80 }),
  date: date('Date'),
  type: select('a type'),
  description: text('Description', 300),
});

export const announcementSchema = z.object({
  title: required('Title', { min: 3, max: 150 }),
  content: required('Content', { min: 10, max: 5000 }),
  category: select('a category'),
  isPinned: z.boolean(),
  expiresAt: optional(z.string().refine((v) => v >= todayStr(), 'Expiry date cannot be in the past')),
});

export const assetSchema = z.object({
  name: required('Asset name', { min: 2, max: 100 }),
  category: select('a category'),
  brand: text('Brand', 50),
  serialNumber: optional(z.string().trim().regex(/^[A-Za-z0-9/-]{3,40}$/, 'Use 3-40 letters, numbers or dashes')),
  purchaseDate: optional(z.string().refine((v) => v <= todayStr(), 'Purchase date cannot be in the future')),
  purchaseCost: number('Purchase cost'),
  status: z.string().optional(),
  notes: text('Notes', 500),
});

export const assignAssetSchema = z.object({
  userId: select('an employee'),
  assignedDate: date('Assigned date').refine((v) => v <= todayStr(), 'Date cannot be in the future'),
});

export const payrollRunSchema = z.object({
  month: number('Month', { min: 1, max: 12, int: true, required: true }),
  year: number('Year', { min: 2000, max: 2100, int: true, required: true }),
});

export const settingsSchema = z
  .object({
    companyName: required('Company name', { min: 2, max: 100 }),
    companyEmail: optional(emailRule),
    companyPhone: optional(z.string().trim().regex(/^[+\d\s()-]{6,20}$/, 'Enter a valid phone number')),
    companyAddress: text('Address', 300),
    timezone: required('Timezone', { max: 60 }).refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Enter a valid timezone (e.g. Asia/Kolkata)'),
    currency: z.string().optional(),
    officeStartTime: time('Office start time'),
    officeEndTime: time('Office end time'),
    graceMinutes: number('Grace period', { max: 120, int: true, required: true }),
    halfDayMinutes: number('Half day minutes', { min: 60, max: 720, int: true, required: true }),
    fullDayMinutes: number('Full day minutes', { min: 60, max: 1440, int: true, required: true }),
    weeklyOffs: z.array(z.number()).max(6, 'At least one working day is required'),
    requireLocationForCheckIn: z.boolean(),
    pfRate: number('PF rate', { max: 100, required: true }),
    pfCeiling: number('PF cap', { required: true }),
    professionalTax: number('Professional tax', { max: 2500, required: true }),
    attendanceBasedLop: z.boolean(),
  })
  .refine((d) => d.officeEndTime > d.officeStartTime, { path: ['officeEndTime'], message: 'End time must be after start time' })
  .refine((d) => d.halfDayMinutes < d.fullDayMinutes, { path: ['halfDayMinutes'], message: 'Half day must be less than full day' });
