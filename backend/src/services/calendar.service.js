import { Holiday } from '../models/index.js';
import { dayOfWeek, eachDate } from '../utils/date.js';

// England & Wales, Scotland and Northern Ireland have different bank holidays; empty regions = whole UK
export function holidayApplies(holiday, region) {
  return !holiday.regions?.length || holiday.regions.includes(region || 'england-wales');
}

// (date, region) -> holiday name or null, for building many employees' calendars from one query
export function buildHolidayLookup(holidays) {
  const byDate = {};
  holidays.forEach((h) => (byDate[h.date] = [...(byDate[h.date] || []), h]));
  return (date, region) => byDate[date]?.find((h) => holidayApplies(h, region))?.name || null;
}

// Non-optional holidays between from and to
export function findHolidays(from, to) {
  return Holiday.find({ date: { $gte: from, $lte: to }, type: { $ne: 'optional' } }).select('date name regions');
}

// Set of holiday dates ("YYYY-MM-DD") between from and to for an employee's region
export async function getHolidayDates(from, to, region) {
  const holidays = await findHolidays(from, to);
  return new Set(holidays.filter((h) => holidayApplies(h, region)).map((h) => h.date));
}

export function isWeeklyOff(dateStr, settings) {
  return settings.weeklyOffs.includes(dayOfWeek(dateStr));
}

// Working dates between from and to (weekly offs and the region's holidays removed)
export async function getWorkingDates(from, to, settings, region) {
  const holidayDates = await getHolidayDates(from, to, region);
  return eachDate(from, to).filter((date) => !isWeeklyOff(date, settings) && !holidayDates.has(date));
}
