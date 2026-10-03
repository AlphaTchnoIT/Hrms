import { z } from 'zod';
import { ASSET_CATEGORIES, ASSET_STATUS, EXPENSE_CATEGORIES, GOAL_STATUS } from '../constants/index.js';
import {
  dateStr,
  intRange,
  objectId,
  optional,
  optionalDate,
  optionalObjectId,
  optionalText,
  requiredText,
  today,
  url,
} from './common.js';

// ---------- Expenses ----------
export const expenseSchema = z.object({
  title: requiredText('Title', { min: 3, max: 100 }),
  category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  amount: z.coerce
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(500000, 'Amount cannot exceed ₹5,00,000'),
  expenseDate: dateStr('Expense date').refine((d) => d <= today(), 'Expense date cannot be in the future'),
  description: optionalText('Description', 500),
  receiptUrl: optional(url('Receipt link')),
});

// ---------- Goals ----------
const rating = (label) =>
  z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce.number().int().min(1, `${label} must be 1-5`).max(5, `${label} must be 1-5`).optional()
  );

export const goalSchema = z
  .object({
    user: optionalObjectId('employee'),
    title: requiredText('Goal title', { min: 3, max: 150 }),
    description: optionalText('Description', 1000),
    startDate: optionalDate('Start date'),
    dueDate: optionalDate('Due date'),
    weightage: intRange('Weightage', 0, 100).optional(),
    progress: intRange('Progress', 0, 100).optional(),
    status: z.enum(GOAL_STATUS).optional(),
    selfRating: rating('Self rating'),
    selfComment: optionalText('Self comment', 500),
    managerRating: rating('Manager rating'),
    managerComment: optionalText('Manager comment', 500),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.dueDate && data.dueDate < data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Due date cannot be before start date' });
    }
  });

// ---------- Assets ----------
export const assetSchema = z.object({
  name: requiredText('Asset name', { min: 2, max: 100 }),
  category: z.enum(ASSET_CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  brand: optionalText('Brand', 50),
  serialNumber: optional(z.string().trim().regex(/^[A-Za-z0-9/-]{3,40}$/, 'Serial number can contain letters, numbers and dashes')),
  purchaseDate: optionalDate('Purchase date').refine((d) => !d || d <= today(), 'Purchase date cannot be in the future'),
  purchaseCost: z.union([z.coerce.number().min(0, 'Cost cannot be negative').max(10000000, 'Cost is too large'), z.literal('')]).optional(),
  status: z.enum(ASSET_STATUS).optional(),
  notes: optionalText('Notes', 500),
});

export const assignAssetSchema = z.object({
  userId: objectId('employee'),
  assignedDate: optionalDate('Assigned date').refine((d) => !d || d <= today(), 'Assigned date cannot be in the future'),
});

// ---------- Payroll ----------
export const payrollRunSchema = z.object({
  month: intRange('Month', 1, 12),
  year: intRange('Year', 2000, 2100),
});
