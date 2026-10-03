/*
 * Date helpers.
 * Calendar dates (attendance day, leave from/to, holidays) are stored as "YYYY-MM-DD" strings.
 * This keeps day-based logic simple and avoids timezone surprises.
 */

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const pad = (n) => String(n).padStart(2, '0');

// Today's date ("YYYY-MM-DD") in the company timezone
export function todayInTz(timeZone, date = new Date()) {
  const { year, month, day } = getZonedParts(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Minutes passed since midnight in the company timezone
export function minutesOfDayInTz(timeZone, date = new Date()) {
  const { hour, minute } = getZonedParts(date, timeZone);
  return hour * 60 + minute;
}

// "09:30" -> 570
export function timeToMinutes(time = '00:00') {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert a local date + time in a timezone into a real Date (UTC instant)
export function zonedTimeToDate(dateStr, timeStr, timeZone) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const zoned = getZonedParts(new Date(utcGuess), timeZone);
  const zonedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
  const offset = zonedAsUtc - utcGuess;
  return new Date(utcGuess - offset);
}

export function isValidDateStr(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function isValidTimeStr(value) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// 0 = Sunday ... 6 = Saturday
export function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

export function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// All dates between from and to (inclusive)
export function eachDate(from, to) {
  const dates = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// month is 1-12
export function monthRange(year, month) {
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  };
}

// Date object -> "YYYY-MM-DD" (UTC based, use for dates stored at midnight)
export function toDateStr(date) {
  return new Date(date).toISOString().slice(0, 10);
}
