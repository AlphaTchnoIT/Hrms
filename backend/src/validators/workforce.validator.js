import { z } from 'zod';
import { dateStr, intRange, objectId, optionalText, requiredText, timeStr } from './common.js';

const userList = z.array(objectId('employee'), { required_error: 'Select at least one employee' }).min(1, 'Select at least one employee').max(500);

function checkRange(data, ctx) {
  if (data.from && data.to && data.to < data.from) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: '"To" date cannot be before "from" date' });
  }
}

export const rosterSchema = z
  .object({
    users: userList,
    from: dateStr('From date'),
    to: dateStr('To date'),
    shiftName: requiredText('Shift name', { max: 40 }),
    startTime: timeStr('Shift start'),
    endTime: timeStr('Shift end'),
    weeklyOffDays: z.array(intRange('Weekly off', 0, 6)).max(6, 'At least one working day is required').default([]),
    notes: optionalText('Notes', 200),
  })
  .superRefine(checkRange)
  .refine((d) => d.startTime !== d.endTime, { path: ['endTime'], message: 'Shift end must differ from shift start' });

export const clearRosterSchema = z.object({ users: userList, from: dateStr('From date'), to: dateStr('To date') }).superRefine(checkRange);

export const loginHoursSchema = z.object({
  user: objectId('employee'),
  date: dateStr('Date'),
  productiveMinutes: intRange('Productive minutes', 0, 1440),
  idleMinutes: intRange('Idle minutes', 0, 1440),
});
