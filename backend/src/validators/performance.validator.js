import { z } from 'zod';
import { ACTION_PLAN_STATUS, KPI_METRICS, KPI_PERIODS } from '../constants/index.js';
import { dateStr, intRange, objectId, optionalDate, optionalText, requiredText, today } from './common.js';

const score = (label) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z
      .number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a number` })
      .min(0, `${label} must be between 0 and 100`)
      .max(100, `${label} must be between 0 and 100`)
  );

export const kpiSchema = z.object({
  user: objectId('employee'),
  metric: z.enum(KPI_METRICS, { errorMap: () => ({ message: 'Select a KPI' }) }),
  period: z.enum(KPI_PERIODS).default('daily'),
  date: dateStr('Date').refine((d) => d <= today(), 'Date cannot be in the future'),
  score: score('Score'),
  target: score('Target').optional(),
  remarks: optionalText('Remarks', 300),
});

export const bulkKpiSchema = z.object({
  entries: z.array(kpiSchema).min(1, 'Add at least one result').max(200, 'At most 200 results at a time'),
});

const actions = z
  .array(requiredText('Action', { min: 3, max: 300 }), { required_error: 'Add at least one action' })
  .min(1, 'Add at least one action')
  .max(15, 'At most 15 actions');

export const actionPlanSchema = z
  .object({
    user: objectId('employee'),
    metric: z.enum([...KPI_METRICS, 'adherence'], { errorMap: () => ({ message: 'Select the KPI to improve' }) }),
    title: requiredText('Title', { min: 5, max: 150 }),
    reason: optionalText('Reason', 500),
    targetScore: score('Target score'),
    startDate: dateStr('Start date'),
    deadline: dateStr('Deadline'),
    followUpDate: optionalDate('Follow-up date'),
    actions,
  })
  .superRefine((d, ctx) => {
    if (d.deadline <= d.startDate) ctx.addIssue({ code: 'custom', path: ['deadline'], message: 'Deadline must be after the start date' });
    if (d.followUpDate && (d.followUpDate < d.startDate || d.followUpDate > d.deadline)) {
      ctx.addIssue({ code: 'custom', path: ['followUpDate'], message: 'Follow-up must be between start date and deadline' });
    }
  });

export const updateActionPlanSchema = z.object({
  title: requiredText('Title', { min: 5, max: 150 }).optional(),
  reason: optionalText('Reason', 500),
  targetScore: score('Target score').optional(),
  deadline: dateStr('Deadline').optional(),
  followUpDate: optionalDate('Follow-up date'),
  status: z.enum(ACTION_PLAN_STATUS).optional(),
  outcome: optionalText('Outcome', 1000),
  actions: actions.optional(),
});

export const checkInSchema = z.object({
  note: requiredText('Follow-up note', { min: 3, max: 1000 }),
  score: score('Score').optional(),
  nextFollowUp: optionalDate('Next follow-up'),
});

export const toggleActionSchema = z.object({ isDone: z.boolean() });
export const acknowledgeSchema = z.object({ comment: optionalText('Comment', 1000) });
export const suggestPlanSchema = z.object({ user: objectId('employee') });

export const generateRatingsSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Select a month'),
  manager: z.union([objectId('manager'), z.literal('')]).optional(),
});

export const updateRatingSchema = z.object({
  finalRating: intRange('Final rating', 1, 5),
  managerComment: optionalText('Comment', 1000),
});

export const approveRatingSchema = z.object({
  approved: z.boolean({ required_error: 'Approve or dispute the rating' }),
  comment: optionalText('Comment', 1000),
  side: z.enum(['qa', 'hr']).optional(),
});
