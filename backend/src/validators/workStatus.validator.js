import { z } from 'zod';
import { optionalText } from './common.js';

export const setStatusSchema = z.object({
  status: z.string({ required_error: 'Choose a status' }).trim().min(1, 'Choose a status').max(40),
  note: optionalText('Note', 120),
});
