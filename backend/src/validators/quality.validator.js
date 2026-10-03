import { z } from 'zod';
import { INTERACTION_CHANNELS, QA_ERROR_CATEGORIES } from '../constants/index.js';
import { dateStr, intRange, objectId, optional, optionalObjectId, optionalText, requiredText, today, url } from './common.js';

export const interactionSchema = z.object({
  reference: requiredText('Interaction reference', { min: 3, max: 40 }),
  agent: objectId('agent'),
  channel: z.enum(INTERACTION_CHANNELS).default('call'),
  customerName: optionalText('Customer name', 80),
  summary: optionalText('Summary', 1000),
  recordingUrl: optional(url('Recording link')),
  resolvedAt: dateStr('Resolved date').refine((d) => d <= today(), 'Resolved date cannot be in the future'),
});

export const qaFeedbackSchema = z
  .object({
    user: objectId('employee'),
    interaction: optionalObjectId('interaction'),
    interactionRef: optionalText('Interaction reference', 40),
    auditDate: dateStr('Audit date').refine((d) => d <= today(), 'Audit date cannot be in the future'),
    score: intRange('Score', 0, 100),
    isFatal: z.boolean().default(false),
    errorCategories: z.array(z.enum(QA_ERROR_CATEGORIES)).max(QA_ERROR_CATEGORIES.length).default([]),
    strengths: optionalText('Strengths', 1000),
    improvements: optionalText('Areas of improvement', 1000),
    comments: optionalText('Comments', 1000),
  })
  .refine((d) => !d.isFatal || d.errorCategories.length, { path: ['errorCategories'], message: 'Select the error category for the fatal error' });

export const acknowledgeFeedbackSchema = z.object({ comment: optionalText('Comment', 1000) });

export const selectCalibrationSchema = z.object({ frequency: z.enum(['daily', 'weekly']).default('weekly') });

export const calibrationAuditSchema = z.object({
  score: intRange('Score', 0, 100),
  notes: optionalText('Notes', 1000),
  side: z.enum(['qa', 'manager']).optional(),
});

export const calibrationSignOffSchema = z.object({
  agreedScore: intRange('Agreed score', 0, 100),
  comment: optionalText('Comment', 500),
  side: z.enum(['qa', 'manager']).optional(),
});
