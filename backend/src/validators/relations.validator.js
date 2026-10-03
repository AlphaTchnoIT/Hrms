import { z } from 'zod';
import { ESCALATION_STATUS, KPI_METRICS, TRIGGER_TYPES, WARNING_CATEGORIES } from '../constants/index.js';
import { dateStr, intRange, objectId, optionalDate, optionalObjectId, optionalText, requiredText, today } from './common.js';

const category = z.enum(WARNING_CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) });

export const escalationSchema = z.object({
  employee: objectId('employee'),
  category,
  incident: requiredText('Incident details', { min: 10, max: 3000 }),
  incidentDate: dateStr('Incident date').refine((d) => d <= today(), 'Incident date cannot be in the future'),
  evidence: optionalText('Evidence', 3000),
  expectations: optionalText('Expectations', 2000),
  followUpDate: optionalDate('Follow-up date'),
});

export const updateEscalationSchema = z.object({
  status: z.enum(ESCALATION_STATUS).optional(),
  outcome: optionalText('Outcome', 2000),
  followUpDate: optionalDate('Follow-up date'),
  note: optionalText('Note', 1000),
});

export const warningSchema = z
  .object({
    employee: objectId('employee'),
    category,
    stage: intRange('Stage', 1, 4).optional(),
    reason: requiredText('Reason', { min: 5, max: 300 }),
    details: optionalText('Details', 3000),
    expectations: optionalText('Expectations', 2000),
    issuedDate: dateStr('Issue date').refine((d) => d <= today(), 'Issue date cannot be in the future'),
    expiresOn: optionalDate('Expiry date'),
    escalation: optionalObjectId('escalation'),
  })
  .refine((d) => !d.expiresOn || d.expiresOn > d.issuedDate, { path: ['expiresOn'], message: 'Expiry must be after the issue date' });

export const warningNoteSchema = z.object({ note: optionalText('Note', 1000), comment: optionalText('Comment', 1000) });

export const triggerSchema = z
  .object({
    name: requiredText('Trigger name', { min: 3, max: 80 }),
    type: z.enum(TRIGGER_TYPES, { errorMap: () => ({ message: 'Select a trigger type' }) }),
    metric: z.union([z.enum(KPI_METRICS), z.literal(''), z.null()]).optional().transform((v) => v || null),
    threshold: intRange('Threshold', 1, 100),
    windowDays: intRange('Window (days)', 1, 365),
    category,
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.type !== 'kpi-failure' || d.metric, { path: ['metric'], message: 'Select the KPI for this trigger' });
