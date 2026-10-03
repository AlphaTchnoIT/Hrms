import { z } from 'zod';
import {
  GRIEVANCE_CATEGORIES,
  GRIEVANCE_STATUS,
  SUGGESTION_STATUS,
  SUGGESTION_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITY,
  TICKET_STATUS,
} from '../constants/index.js';
import { optionalObjectId, optionalText, requiredText } from './common.js';

export const ticketSchema = z.object({
  category: z.enum(TICKET_CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  priority: z.enum(TICKET_PRIORITY).default('medium'),
  subject: requiredText('Subject', { min: 5, max: 150 }),
  description: requiredText('Description', { min: 10, max: 5000 }),
  assetTag: optionalText('Asset tag', 30),
});

export const updateTicketSchema = z.object({
  status: z.enum(TICKET_STATUS).optional(),
  priority: z.enum(TICKET_PRIORITY).optional(),
  assignedTo: optionalObjectId('IT agent'),
  resolution: optionalText('Resolution', 2000),
});

export const commentSchema = z.object({
  message: requiredText('Message', { max: 3000 }),
  isInternal: z.boolean().optional(),
});

export const closeTicketSchema = z.object({ reopen: z.boolean().optional(), message: optionalText('Message', 1000) });

export const grievanceSchema = z.object({
  category: z.enum(GRIEVANCE_CATEGORIES, { errorMap: () => ({ message: 'Select a category' }) }),
  subject: requiredText('Subject', { min: 5, max: 150 }),
  description: requiredText('Description', { min: 20, max: 5000 }),
  isAnonymous: z.boolean().default(false),
});

export const updateGrievanceSchema = z.object({
  status: z.enum(GRIEVANCE_STATUS),
  resolution: optionalText('Resolution', 3000),
});

export const suggestionSchema = z.object({
  type: z.enum(SUGGESTION_TYPES).default('suggestion'),
  title: requiredText('Title', { min: 5, max: 150 }),
  description: requiredText('Description', { min: 10, max: 3000 }),
});

export const respondSuggestionSchema = z.object({
  status: z.enum(SUGGESTION_STATUS),
  response: optionalText('Response', 2000),
});
