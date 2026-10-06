import { DEFAULT_POLICIES } from '../constants/index.js';

// Company HR policies with defaults filled in
export function getPolicies(settings) {
  return { ...DEFAULT_POLICIES, ...(settings?.policies?.toObject?.() || settings?.policies || {}) };
}

/*
 * Leave year a date falls in, named by the calendar year it starts in.
 * Start month 4 (April-March): 2026-03-10 -> 2025, 2026-04-01 -> 2026.
 */
export function leaveYearOf(dateStr, startMonth = 1) {
  const [y, m] = dateStr.split('-').map(Number);
  return m >= startMonth ? y : y - 1;
}

// First and last day ("YYYY-MM-DD") of a leave year
export function leaveYearRange(year, startMonth = 1) {
  const pad = (n) => String(n).padStart(2, '0');
  const from = `${year}-${pad(startMonth)}-01`;
  const end = new Date(Date.UTC(year + 1, startMonth - 1, 0)); // day before the next leave year starts
  return { from, to: end.toISOString().slice(0, 10) };
}
