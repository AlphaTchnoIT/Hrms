import { z } from 'zod';
import {
  APPLICATION_STATUS,
  DOCUMENT_STATUS,
  EMPLOYMENT_TYPES,
  INTERVIEW_MODES,
  INTERVIEW_RESULTS,
  JOB_STATUS,
} from '../constants/index.js';
import { email, intRange, objectId, optional, optionalDate, optionalObjectId, optionalText, personName, phone, requiredText, url } from './common.js';

export const jobSchema = z.object({
  title: requiredText('Job title', { min: 3, max: 100 }),
  department: optionalObjectId('department'),
  designation: optionalObjectId('designation'),
  location: optionalText('Location', 100),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('full-time'),
  description: requiredText('Description', { min: 20, max: 5000 }),
  requirements: optionalText('Requirements', 3000),
  openings: intRange('Openings', 1, 500),
  isInternal: z.boolean().default(true),
  minTenureMonths: intRange('Minimum tenure', 0, 120).default(0),
  blockOnFinalWarning: z.boolean().default(true),
  closingDate: optionalDate('Closing date'),
  status: z.enum(JOB_STATUS).default('open'),
});

export const candidateSchema = z.object({
  job: objectId('job'),
  candidate: z.object({
    name: personName('Candidate name'),
    email,
    phone: optional(phone),
  }),
  resumeUrl: optional(url('Resume link')),
  coverNote: optionalText('Cover note', 2000),
  source: z.enum(['external', 'referral']).default('external'),
  hrNotes: optionalText('Notes', 2000),
});

export const applyInternalSchema = z.object({
  coverNote: requiredText('Why are you a good fit?', { min: 20, max: 2000 }),
  resumeUrl: optional(url('Resume link')),
});

export const applicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUS, { errorMap: () => ({ message: 'Select a status' }) }),
  note: optionalText('Note', 500),
});

export const interviewSchema = z.object({
  round: requiredText('Round', { max: 60 }),
  scheduledAt: z
    .string({ required_error: 'Interview date and time is required' })
    .min(1, 'Interview date and time is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date and time'),
  durationMinutes: intRange('Duration', 10, 480).default(45),
  mode: z.enum(INTERVIEW_MODES).default('video'),
  location: optionalText('Location / meeting link', 300),
  interviewers: z.array(objectId('interviewer')).min(1, 'Select at least one interviewer').max(10),
});

export const interviewResultSchema = z.object({
  result: z.enum(INTERVIEW_RESULTS),
  feedback: optionalText('Feedback', 3000),
});

export const requestDocumentsSchema = z.object({
  names: z.array(requiredText('Document name', { min: 2, max: 80 })).min(1, 'Add at least one document').max(20),
  note: optionalText('Note', 300),
});

export const reviewDocumentSchema = z.object({
  status: z.enum(DOCUMENT_STATUS),
  note: optionalText('Note', 300),
});

export const submitDocumentSchema = z.object({ url: url('Document link'), email: optional(email) });
