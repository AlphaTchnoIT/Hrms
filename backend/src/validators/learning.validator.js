import { z } from 'zod';
import { dateStr, intRange, objectId, optional, optionalDate, optionalText, requiredText, url } from './common.js';

export const programSchema = z.object({
  title: requiredText('Programme title', { min: 3, max: 120 }),
  description: optionalText('Description', 2000),
  category: optionalText('Category', 40),
  durationHours: z.coerce.number({ invalid_type_error: 'Duration must be a number' }).min(0).max(500).default(1),
  contentUrl: optional(url('Content link')),
  completionCriteria: optionalText('Completion requirement', 500),
  isActive: z.boolean().default(true),
});

export const assignTrainingSchema = z.object({
  program: objectId('programme'),
  users: z.array(objectId('employee')).min(1, 'Select at least one employee').max(500),
  dueDate: dateStr('Due date'),
});

export const progressSchema = z.object({ progress: intRange('Progress', 0, 100) });

const questionSchema = z
  .object({
    text: requiredText('Question', { min: 5, max: 500 }),
    options: z.array(requiredText('Option', { max: 200 })).min(2, 'Add at least 2 options').max(6, 'At most 6 options'),
    correctIndex: intRange('Correct answer', 0, 5),
    marks: intRange('Marks', 1, 10).default(1),
  })
  .refine((q) => q.correctIndex < q.options.length, { path: ['correctIndex'], message: 'Select the correct answer' });

export const testSchema = z
  .object({
    title: requiredText('Test title', { min: 3, max: 120 }),
    description: optionalText('Description', 1000),
    questions: z.array(questionSchema).min(1, 'Add at least one question').max(100),
    passPercent: intRange('Pass mark', 0, 100).default(70),
    maxAttempts: intRange('Attempts', 1, 10).default(2),
    timeLimitMinutes: intRange('Time limit', 0, 300).default(0),
    availableFrom: optionalDate('Available from'),
    dueDate: optionalDate('Due date'),
    assignedTo: z.array(objectId('employee')).max(1000).default([]),
    isPublished: z.boolean().default(true),
  })
  .refine((d) => !d.availableFrom || !d.dueDate || d.dueDate >= d.availableFrom, { path: ['dueDate'], message: 'Due date must be after the start date' });

export const updateTestSchema = z.object({
  title: requiredText('Test title', { min: 3, max: 120 }).optional(),
  description: optionalText('Description', 1000),
  passPercent: intRange('Pass mark', 0, 100).optional(),
  maxAttempts: intRange('Attempts', 1, 10).optional(),
  dueDate: optionalDate('Due date'),
  isPublished: z.boolean().optional(),
});

export const attemptSchema = z.object({
  answers: z.array(z.number().int().min(-1).max(5)).min(1, 'Please answer the questions'),
});
