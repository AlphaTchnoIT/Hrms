import { z } from 'zod';
import { COMPLIANCE_STATUS } from '../models/compliance.model.js';
import { optional, optionalDate, optionalText, requiredText, url } from './common.js';

export const complianceItemSchema = z.object({
  category: requiredText('Category', { max: 60 }),
  title: requiredText('Title', { min: 3, max: 150 }),
  description: optionalText('Description', 1000),
  status: z.enum(COMPLIANCE_STATUS, { errorMap: () => ({ message: 'Choose a status' }) }),
  owner: optionalText('Owner', 80),
  reviewedBy: optionalText('Reviewed by', 120),
  reviewedOn: optionalDate('Review date'),
  nextReviewOn: optionalDate('Next review date'),
  documentUrl: optional(url('Document link')),
  notes: optionalText('Notes', 2000),
});
