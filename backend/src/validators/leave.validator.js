import { z } from 'zod';
import { dateStr, intRange, objectId, optionalDate, optionalText, requiredText } from './common.js';

export const applyLeaveSchema = z
  .object({
    leaveType: objectId('leave type'),
    fromDate: dateStr('From date'),
    toDate: optionalDate('To date'),
    isHalfDay: z.boolean().optional().default(false),
    halfDaySession: z.enum(['first-half', 'second-half']).optional().nullable(),
    reason: requiredText('Reason', { min: 5, max: 500 }),
  })
  .superRefine((data, ctx) => {
    if (data.isHalfDay) return;
    if (!data.toDate) {
      ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'To date is required' });
    } else if (data.toDate < data.fromDate) {
      ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'To date cannot be before From date' });
    } else if (data.fromDate.slice(0, 4) !== data.toDate.slice(0, 4)) {
      ctx.addIssue({ code: 'custom', path: ['toDate'], message: 'Apply separately for each calendar year' });
    }
  });

export const leaveBalanceSchema = z.object({
  leaveType: objectId('leave type'),
  year: intRange('Year', 2000, 2100).optional(),
  allocated: z.coerce
    .number({ invalid_type_error: 'Allocated days must be a number' })
    .min(0, 'Allocated days cannot be negative')
    .max(365, 'Allocated days cannot exceed 365')
    .refine((v) => Number.isInteger(v * 2), 'Use whole or half days (e.g. 7.5)'),
});

export const leaveTypeSchema = z.object({
  name: requiredText('Leave type name', { min: 2, max: 50 }),
  code: z
    .string({ required_error: 'Code is required' })
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, 'Code must be 2-6 letters (e.g. CL)'),
  annualQuota: z.coerce
    .number({ invalid_type_error: 'Days per year must be a number' })
    .min(0, 'Days per year cannot be negative')
    .max(365, 'Days per year cannot exceed 365')
    .refine((v) => Number.isInteger(v * 2), 'Use whole or half days'),
  isPaid: z.boolean().optional(),
  allowHalfDay: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour').optional(),
  description: optionalText('Description', 300),
  isActive: z.boolean().optional(),
});
