import { z } from 'zod';
import { ANNOUNCEMENT_CATEGORIES, HOLIDAY_TYPES, WORK_STATUS_CATEGORIES } from '../constants/index.js';
import { dateStr, intRange, optional, optionalDate, optionalObjectId, optionalText, requiredText, timeStr, email, phone } from './common.js';

const percent = (label) => intRange(label, 0, 100);

export const departmentSchema = z.object({
  name: requiredText('Department name', { min: 2, max: 60 }),
  code: optional(z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/, 'Code must be 2-10 letters or numbers')),
  description: optionalText('Description', 300),
  head: optionalObjectId('department head'),
  isActive: z.boolean().optional(),
});

export const designationSchema = z.object({
  title: requiredText('Designation title', { min: 2, max: 60 }),
  level: intRange('Level', 1, 20),
  description: optionalText('Description', 300),
  isActive: z.boolean().optional(),
});

export const holidaySchema = z.object({
  name: requiredText('Holiday name', { min: 2, max: 80 }),
  date: dateStr('Date'),
  type: z.enum(HOLIDAY_TYPES, { errorMap: () => ({ message: 'Select a holiday type' }) }),
  description: optionalText('Description', 300),
});

export const announcementSchema = z.object({
  title: requiredText('Title', { min: 3, max: 150 }),
  content: requiredText('Content', { min: 10, max: 5000 }),
  category: z.enum(ANNOUNCEMENT_CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  isPinned: z.boolean().optional(),
  expiresAt: optionalDate('Expiry date'),
});

export const settingsSchema = z
  .object({
    companyName: requiredText('Company name', { min: 2, max: 100 }),
    companyEmail: optional(email),
    companyPhone: optional(phone.or(z.string().trim().regex(/^[+\d\s()-]{6,20}$/, 'Enter a valid phone number'))),
    companyAddress: optionalText('Address', 300),
    timezone: requiredText('Timezone', { max: 60 }).refine((tz) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Enter a valid timezone (e.g. Asia/Kolkata)'),
    currency: optional(z.string().trim().length(3, 'Currency must be a 3 letter code')),
    officeStartTime: timeStr('Office start time'),
    officeEndTime: timeStr('Office end time'),
    graceMinutes: intRange('Grace period', 0, 120),
    halfDayMinutes: intRange('Half day minutes', 60, 720),
    fullDayMinutes: intRange('Full day minutes', 60, 1440),
    weeklyOffs: z.array(intRange('Weekly off', 0, 6)).max(6, 'At least one working day is required'),
    requireLocationForCheckIn: z.boolean(),
    pfRate: z.coerce.number().min(0, 'PF rate cannot be negative').max(100, 'PF rate cannot exceed 100%'),
    pfCeiling: z.coerce.number().min(0, 'PF cap cannot be negative'),
    professionalTax: z.coerce.number().min(0, 'Professional tax cannot be negative').max(2500, 'Professional tax cannot exceed ₹2,500'),
    attendanceBasedLop: z.boolean(),
    kpiTargets: z.object({
      quality: percent('Quality target'),
      efficiency: percent('Efficiency target'),
      classification: percent('Classification target'),
      adherence: percent('Adherence target'),
    }),
    kpiWeights: z
      .object({
        quality: percent('Quality weight'),
        efficiency: percent('Efficiency weight'),
        classification: percent('Classification weight'),
      })
      .refine((w) => w.quality + w.efficiency + w.classification === 100, {
        path: ['quality'],
        message: 'Weights must add up to 100',
      }),
    attentionBand: intRange('Needs attention band', 1, 50),
    efficiencyGlidePath: z
      .array(z.object({ week: intRange('Week', 1, 104), target: percent('Glide path target') }))
      .max(12, 'At most 12 glide path steps'),
    shortLoginPercent: intRange('Short login %', 50, 100),
    idleAlertMinutes: intRange('Idle alert minutes', 0, 600),
    calibrationTolerance: intRange('Calibration tolerance', 0, 50),
    workStatuses: z
      .array(
        z.object({
          key: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, 'Status key can only use lowercase letters, numbers and dashes'),
          label: requiredText('Status name', { max: 40 }),
          category: z.enum(WORK_STATUS_CATEGORIES, { errorMap: () => ({ message: 'Choose a valid category' }) }),
          active: z.boolean().default(true),
        })
      )
      .max(30, 'At most 30 statuses')
      .refine((list) => new Set(list.map((s) => s.key)).size === list.length, 'Two statuses have the same key')
      .refine((list) => list.some((s) => s.active && s.category === 'productive'), 'Keep at least one active productive status'),
  })
  .partial()
  .superRefine((data, ctx) => {
    if (data.officeStartTime && data.officeEndTime && data.officeEndTime <= data.officeStartTime) {
      ctx.addIssue({ code: 'custom', path: ['officeEndTime'], message: 'End time must be after start time' });
    }
    if (data.halfDayMinutes && data.fullDayMinutes && data.halfDayMinutes >= data.fullDayMinutes) {
      ctx.addIssue({ code: 'custom', path: ['halfDayMinutes'], message: 'Half day must be less than full day' });
    }
  });
