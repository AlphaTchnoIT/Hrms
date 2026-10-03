import { Holiday } from '../models/index.js';
import { dayOfWeek, eachDate } from '../utils/date.js';

// Set of holiday dates ("YYYY-MM-DD") between from and to
export async function getHolidayDates(from, to) {
  const holidays = await Holiday.find({ date: { $gte: from, $lte: to }, type: { $ne: 'optional' } }).select('date');
  return new Set(holidays.map((h) => h.date));
}

export function isWeeklyOff(dateStr, settings) {
  return settings.weeklyOffs.includes(dayOfWeek(dateStr));
}

// Working dates between from and to (weekly offs and holidays removed)
export async function getWorkingDates(from, to, settings) {
  const holidayDates = await getHolidayDates(from, to);
  return eachDate(from, to).filter((date) => !isWeeklyOff(date, settings) && !holidayDates.has(date));
}
