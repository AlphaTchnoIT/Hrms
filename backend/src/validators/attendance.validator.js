import { z } from 'zod';
import { dateStr, optionalText, requiredText, timeStr } from './common.js';

export const punchSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  note: optionalText('Note', 200),
});

export const regularizationSchema = z
  .object({
    date: dateStr('Date'),
    checkInTime: timeStr('Check-in time'),
    checkOutTime: timeStr('Check-out time'),
    reason: requiredText('Reason', { min: 5, max: 300 }),
  })
  .superRefine((data, ctx) => {
    if (data.checkOutTime <= data.checkInTime) {
      ctx.addIssue({ code: 'custom', path: ['checkOutTime'], message: 'Check-out time must be after check-in time' });
    }
  });
