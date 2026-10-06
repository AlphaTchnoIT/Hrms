import { z } from 'zod';

/*
 * Reusable validation rules shared by all module validators.
 * Messages are written for end users because they are shown under the form fields.
 */

// Allow an optional field to also be sent as an empty string (empty form input)
export const optional = (schema) => schema.optional().or(z.literal(''));

export const objectId = (label = 'value') =>
  z.string({ required_error: `Please select a ${label}`, invalid_type_error: `Please select a ${label}` })
    .regex(/^[a-f\d]{24}$/i, `Please select a valid ${label}`);

// Optional reference: "" or null become null so the link can be cleared
export const optionalObjectId = (label) =>
  z.union([objectId(label), z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v));

export const requiredText = (label, { min = 1, max = 200 } = {}) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const optionalText = (label, max = 500) =>
  optional(z.string().trim().max(max, `${label} must be at most ${max} characters`));

export const personName = (label) =>
  requiredText(label, { max: 50 }).regex(/^[A-Za-z][A-Za-z\s.'-]*$/, `${label} can contain only letters`);

export const email = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

// UK numbers ("07700 900123", "+44 20 7946 0123") or any international number starting with +
export const phone = z
  .string()
  .trim()
  .refine((v) => {
    const digits = v.replace(/[\s\-()]/g, '');
    return /^(?:0\d{9,10}|\+44\d{9,10}|\+[1-9]\d{7,14})$/.test(digits);
  }, 'Enter a valid phone number (e.g. 07700 900123)');

// UK postcode, e.g. "EC2A 4NE", "SW1A 1AA"
export const postcode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/, 'Enter a valid UK postcode (e.g. EC2A 4NE)');

export const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password must be at most 64 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

export const dateStr = (label = 'Date') =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .min(1, `${label} is required`)
    .regex(/^\d{4}-\d{2}-\d{2}/, `Enter a valid ${label.toLowerCase()}`)
    .refine((v) => !Number.isNaN(Date.parse(v)), `Enter a valid ${label.toLowerCase()}`)
    .transform((v) => v.slice(0, 10));

// Optional date: "" or null become null
export const optionalDate = (label) =>
  z.union([dateStr(label), z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v));

export const timeStr = (label = 'Time') =>
  z
    .string({ required_error: `${label} is required` })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `Enter a valid ${label.toLowerCase()} (HH:mm)`);

// Optional amount: missing stays undefined, empty input becomes 0
export const money = (label, { max = 10000000 } = {}) =>
  z.preprocess(
    (v) => (v === '' || v === null ? 0 : v),
    z.coerce
      .number({ invalid_type_error: `${label} must be a number` })
      .min(0, `${label} cannot be negative`)
      .max(max, `${label} is too large`)
      .optional()
  );

export const intRange = (label, min, max) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be at least ${min}`)
      .max(max, `${label} must be at most ${max}`)
  );

export const url = (label = 'Link') => z.string().trim().url(`Enter a valid ${label.toLowerCase()} (https://...)`);

// Today as "YYYY-MM-DD" (server local time is good enough for range checks)
export const today = () => new Date().toISOString().slice(0, 10);

export const reviewSchema = z
  .object({
    action: z.enum(['approve', 'reject'], { errorMap: () => ({ message: 'Action must be approve or reject' }) }),
    note: optionalText('Note', 500),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'reject' && (!data.note || data.note.trim().length < 3)) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Please give a reason for rejection' });
    }
  });
