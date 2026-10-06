import { Attendance, Settings, User, WorkStatusLog } from '../models/index.js';
import { WORK_STATUS_CATEGORIES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { isValidDateStr, todayInTz } from '../utils/date.js';
import { canManageEmployee, getScopedUsers } from '../services/access.service.js';
import {
  closeStaleLogs,
  getActiveStatuses,
  getCurrentLog,
  getDayLogs,
  presenceOf,
  startStatus,
  summarize,
} from '../services/workStatus.service.js';

const toCurrent = (log) =>
  log && { status: log.status, label: log.label, category: log.category, note: log.note, since: log.startedAt };

// GET /api/work-status/options - statuses employees can pick from
export async function getStatusOptions(_req, res) {
  const settings = await Settings.getSettings();
  sendSuccess(res, { data: { statuses: getActiveStatuses(settings), categories: WORK_STATUS_CATEGORIES } });
}

// GET /api/work-status/me - my current status, today's attendance and how my day was spent
export async function getMyStatus(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const [current, attendance, logs] = await Promise.all([
    getCurrentLog(req.user._id, settings),
    Attendance.findOne({ user: req.user._id, date: today }).select('checkIn checkOut'),
    getDayLogs(req.user._id, today),
  ]);

  sendSuccess(res, {
    data: {
      date: today,
      current: toCurrent(current),
      checkedIn: Boolean(attendance?.checkIn?.time),
      checkedOut: Boolean(attendance?.checkOut?.time),
      summary: summarize(logs),
    },
  });
}

// POST /api/work-status { status, note } - change my status (only between check-in and check-out)
export async function setMyStatus(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);

  const attendance = await Attendance.findOne({ user: req.user._id, date: today }).select('checkIn checkOut');
  if (!attendance?.checkIn?.time) throw ApiError.badRequest('Please check in before setting your status');
  if (attendance.checkOut?.time) throw ApiError.badRequest('You have already checked out today');

  const status = getActiveStatuses(settings).find((s) => s.key === req.body.status);
  if (!status) throw ApiError.field('status', 'Choose a valid status');

  const note = req.body.note?.trim() || undefined;
  const current = await getCurrentLog(req.user._id, settings);
  if (current && current.status === status.key && (current.note || undefined) === note) {
    return sendSuccess(res, { data: toCurrent(current), message: `You are ${status.label}` });
  }

  const log = await startStatus(req.user._id, status, { note, settings });
  sendSuccess(res, { data: toCurrent(log), message: `Status set to ${status.label}` });
}

/*
 * GET /api/work-status/team?scope&manager - live board for TL / manager / HR
 * Everyone in the user's team with their current status and today's time per category.
 */
export async function getTeamStatus(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const managerId = req.query.manager || undefined;
  const users = await getScopedUsers(req.user, { scope: req.query.scope, managerId, select: 'firstName lastName employeeCode avatar designation reportingManager' });
  const ids = users.map((u) => u._id);

  await closeStaleLogs(settings, { $in: ids });
  const [logs, attendance] = await Promise.all([
    WorkStatusLog.find({ user: { $in: ids }, date: today }).sort({ startedAt: 1 }),
    Attendance.find({ user: { $in: ids }, date: today }).select('user checkIn checkOut'),
  ]);

  const now = new Date();
  const logsBy = new Map();
  logs.forEach((log) => logsBy.set(String(log.user), [...(logsBy.get(String(log.user)) || []), log]));
  const attendanceBy = new Map(attendance.map((a) => [String(a.user), a]));

  const members = users.map((user) => {
    const own = logsBy.get(String(user._id)) || [];
    const current = own.find((l) => !l.endedAt);
    const record = attendanceBy.get(String(user._id));
    return {
      user,
      current: toCurrent(current),
      checkIn: record?.checkIn?.time || null,
      checkOut: record?.checkOut?.time || null,
      today: summarize(own, now),
    };
  });

  // Headcount per current category (+ offline) for the board's summary chips
  const counts = Object.fromEntries([...WORK_STATUS_CATEGORIES, 'offline'].map((c) => [c, 0]));
  members.forEach((m) => (counts[m.current?.category || 'offline'] += 1));

  sendSuccess(res, { data: { date: today, members, counts } });
}

// GET /api/work-status/day?user&date - one person's timeline for a day (self, their TL / manager chain, HR)
export async function getDayTimeline(req, res) {
  const settings = await Settings.getSettings();
  const userId = req.query.user || String(req.user._id);
  const isSelf = userId === String(req.user._id);
  if (!isSelf && !(await canManageEmployee(req.user, userId))) throw ApiError.forbidden();

  const date = isValidDateStr(req.query.date) ? req.query.date : todayInTz(settings.timezone);
  await closeStaleLogs(settings, userId);
  const [user, logs, attendance] = await Promise.all([
    User.findById(userId).select('firstName lastName employeeCode avatar'),
    getDayLogs(userId, date),
    Attendance.findOne({ user: userId, date }).select('checkIn checkOut workMinutes'),
  ]);
  if (!user) throw ApiError.notFound('Employee not found');

  sendSuccess(res, {
    data: {
      user,
      date,
      checkIn: attendance?.checkIn?.time || null,
      checkOut: attendance?.checkOut?.time || null,
      loginMinutes: attendance?.workMinutes || 0,
      logs: logs.map((l) => ({ ...toCurrent(l), endedAt: l.endedAt, endReason: l.endReason, minutes: Math.round(((l.endedAt || new Date()) - l.startedAt) / 60000) })),
      summary: summarize(logs),
    },
  });
}

/*
 * GET /api/work-status/presence - simple dot for every colleague: available / busy / away
 * (offline when missing). No status names or notes, those are for the person's managers and HR.
 */
export async function getPresence(_req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const open = await WorkStatusLog.find({ endedAt: null, date: today }).select('user status category');
  sendSuccess(res, { data: Object.fromEntries(open.map((log) => [String(log.user), presenceOf(log)])) });
}
