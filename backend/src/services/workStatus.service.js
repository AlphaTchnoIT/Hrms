import { Attendance, WorkStatusLog } from '../models/index.js';
import { WORK_STATUS_CATEGORIES } from '../constants/index.js';
import { todayInTz, zonedTimeToDate } from '../utils/date.js';

/*
 * Live Work Status helpers.
 * A log row = one status for a stretch of time. The open row (endedAt = null) is the current status.
 */

export function getActiveStatuses(settings) {
  return (settings.workStatuses || []).filter((s) => s.active !== false);
}

// The status set automatically at check-in: "Available", or the first active productive status
export function getDefaultStatus(settings) {
  const active = getActiveStatuses(settings);
  return active.find((s) => s.key === 'available') || active.find((s) => s.category === 'productive') || active[0];
}

export function minutesOf(log, now = new Date()) {
  return Math.max(0, ((log.endedAt || now) - log.startedAt) / 60000);
}

// Minutes per category and per status, e.g. { categories: { productive: 312, break: 45 }, statuses: { email: 120 } }
export function summarize(logs, now = new Date()) {
  const categories = Object.fromEntries(WORK_STATUS_CATEGORIES.map((c) => [c, 0]));
  const statuses = {};
  logs.forEach((log) => {
    const minutes = minutesOf(log, now);
    categories[log.category] = (categories[log.category] || 0) + minutes;
    statuses[log.status] = (statuses[log.status] || 0) + minutes;
  });
  const round = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Math.round(v)]));
  const total = Object.values(categories).reduce((a, b) => a + b, 0);
  return { categories: round(categories), statuses: round(statuses), total: Math.round(total) };
}

// What colleagues see: just available / busy / away (offline = no open status)
export function presenceOf(log) {
  if (!log) return 'offline';
  if (log.category === 'productive') return log.status === 'available' ? 'available' : 'busy';
  if (['approved', 'system'].includes(log.category)) return 'busy';
  return 'away';
}

/*
 * Someone who never checked out leaves a status open from an earlier day.
 * Close it at that day's check-out, or else at office end time (never before it started).
 */
export async function closeStaleLogs(settings, userFilter) {
  const today = todayInTz(settings.timezone);
  const stale = await WorkStatusLog.find({ endedAt: null, date: { $lt: today }, ...(userFilter ? { user: userFilter } : {}) });
  if (!stale.length) return;

  const attendance = await Attendance.find({ $or: stale.map((l) => ({ user: l.user, date: l.date })) }).select('user date checkOut');
  const checkOutOf = new Map(attendance.map((a) => [`${a.user}|${a.date}`, a.checkOut?.time]));

  await Promise.all(
    stale.map((log) => {
      const end = checkOutOf.get(`${log.user}|${log.date}`) || zonedTimeToDate(log.date, settings.officeEndTime, settings.timezone);
      log.endedAt = end > log.startedAt ? end : log.startedAt;
      log.endReason = 'auto-closed';
      return log.save();
    })
  );
}

export async function getCurrentLog(userId, settings) {
  await closeStaleLogs(settings, userId);
  return WorkStatusLog.findOne({ user: userId, endedAt: null }).sort({ startedAt: -1 });
}

// Close the current status (if any) at `at`
export async function endCurrentStatus(userId, { at = new Date(), reason = 'changed' } = {}) {
  await WorkStatusLog.updateMany({ user: userId, endedAt: null }, { endedAt: at, endReason: reason });
}

// Switch to a new status: closes the current one and opens the new one at the same moment
export async function startStatus(userId, status, { note, settings, at = new Date() }) {
  await endCurrentStatus(userId, { at, reason: 'changed' });
  return WorkStatusLog.create({
    user: userId,
    date: todayInTz(settings.timezone, at),
    status: status.key,
    label: status.label,
    category: status.category,
    note: note || undefined,
    startedAt: at,
  });
}

export function getDayLogs(userId, date) {
  return WorkStatusLog.find({ user: userId, date }).sort({ startedAt: 1 });
}
