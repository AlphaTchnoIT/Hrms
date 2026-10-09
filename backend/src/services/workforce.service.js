import { Attendance, LeaveRequest, Roster } from '../models/index.js';
import { buildHolidayLookup, findHolidays } from './calendar.service.js';
import { addDays, dayOfWeek, eachDate, minutesOfDayInTz, monthRange, timeToMinutes, toDateStr, todayInTz, zonedTimeToDate } from '../utils/date.js';

// Length of a shift in minutes. Night shifts end the next day (end < start).
export function shiftMinutes(startTime, endTime) {
  let minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes;
}

// The default shift for a date when the employee has no roster entry
export function defaultShift(date, settings) {
  return {
    shiftName: 'General',
    startTime: settings.officeStartTime,
    endTime: settings.officeEndTime,
    isWeeklyOff: settings.weeklyOffs.includes(dayOfWeek(date)),
    isDefault: true,
  };
}

// Sick / emergency (UK: Time Off for Dependants) / other approved leave, decided from the leave type code or name
export function leaveStatus(leaveType) {
  const key = `${leaveType?.code || ''} ${leaveType?.name || ''}`.toLowerCase();
  if (/\bsl\b|sick/.test(key)) return 'sick-leave';
  if (/\beml\b|\btod\b|emergency|dependant/.test(key)) return 'emergency-leave';
  return 'approved-leave';
}

/*
 * Loads roster, attendance, leaves and holidays for many users in 4 queries
 * and returns { [userId]: { days, summary } }.
 */
export async function getWorkforce(users, from, to, settings) {
  const userIds = users.map((u) => u._id);
  // lean(): plain objects are much cheaper than Mongoose documents for read-only reports
  // (schema defaults are applied in buildDay instead)
  const [rosters, records, leaves, holidays] = await Promise.all([
    Roster.find({ user: { $in: userIds }, date: { $gte: from, $lte: to } }).lean(),
    Attendance.find({ user: { $in: userIds }, date: { $gte: from, $lte: to } }).lean(),
    LeaveRequest.find({ user: { $in: userIds }, status: 'approved', fromDate: { $lte: to }, toDate: { $gte: from } })
      .populate('leaveType', 'name code color')
      .lean(),
    findHolidays(from, to),
  ]);

  const key = (userId, date) => `${userId}|${date}`;
  const rosterMap = new Map(rosters.map((r) => [key(r.user, r.date), r]));
  const recordMap = new Map(records.map((r) => [key(r.user, r.date), r]));
  const holidayOf = buildHolidayLookup(holidays);
  const leaveMap = new Map();
  leaves.forEach((leave) =>
    eachDate(leave.fromDate > from ? leave.fromDate : from, leave.toDate < to ? leave.toDate : to).forEach((date) =>
      leaveMap.set(key(leave.user, date), leave)
    )
  );

  const today = todayInTz(settings.timezone);
  const result = {};
  users.forEach((user) => {
    const joinDate = user.dateOfJoining ? toDateStr(user.dateOfJoining) : from;
    const days = eachDate(from, to)
      .filter((date) => date >= joinDate)
      .map((date) =>
        buildDay({
          date,
          today,
          settings,
          roster: rosterMap.get(key(user._id, date)),
          record: recordMap.get(key(user._id, date)),
          leave: leaveMap.get(key(user._id, date)),
          holiday: holidayOf(date, user.holidayRegion),
        })
      );
    result[String(user._id)] = { days, summary: summarize(days, settings) };
  });
  return result;
}

/*
 * Schedule adherence: minutes of the shift the employee was logged in (check-in to check-out inside the shift window).
 * Without a check-out, a login still in progress (today, or a night shift that has not ended yet) counts up to now;
 * a finished day without a check-out counts 0.
 */
export function adherentMinutes({ date, shift, scheduledMinutes, record, timeZone, today, now = new Date() }) {
  if (!scheduledMinutes || !record?.checkIn?.time) return 0;
  const start = zonedTimeToDate(date, shift.startTime, timeZone).getTime();
  const end = start + scheduledMinutes * 60000;
  const loginStart = new Date(record.checkIn.time).getTime();
  const inProgress = date === (today ?? todayInTz(timeZone, now)) || now.getTime() < end;
  const loginEnd = record.checkOut?.time ? new Date(record.checkOut.time).getTime() : inProgress ? now.getTime() : loginStart;
  return Math.max(0, Math.round((Math.min(end, loginEnd) - Math.max(start, loginStart)) / 60000));
}

function buildDay({ date, today, settings, roster, record, leave, holiday }) {
  // Same defaults as the Roster schema (records are lean)
  const shift = roster
    ? {
        shiftName: roster.shiftName ?? 'General',
        startTime: roster.startTime ?? '09:00',
        endTime: roster.endTime ?? '17:30',
        isWeeklyOff: Boolean(roster.isWeeklyOff),
        isDefault: false,
      }
    : defaultShift(date, settings);
  const scheduledMinutes = shift.isWeeklyOff ? 0 : shiftMinutes(shift.startTime, shift.endTime);

  const day = {
    date,
    shift,
    scheduledMinutes,
    loginMinutes: record?.workMinutes || 0,
    adherentMinutes: adherentMinutes({ date, shift, scheduledMinutes, record, timeZone: settings.timezone, today }),
    productiveMinutes: record?.productiveMinutes ?? null,
    idleMinutes: record?.idleMinutes ?? null,
    checkIn: record?.checkIn?.time || null,
    checkOut: record?.checkOut?.time || null,
    attendanceId: record?._id || null,
    isLate: false,
    lateByMinutes: 0,
    isShort: false,
    isIdle: Boolean(record?.idleMinutes && record.idleMinutes > settings.idleAlertMinutes),
    holiday: holiday || null,
    leaveType: leave?.leaveType?.name || null,
  };

  if (record) {
    if (record.checkIn?.time && !shift.isWeeklyOff) {
      const checkInMinutes = minutesOfDayInTz(settings.timezone, record.checkIn.time);
      const late = checkInMinutes - timeToMinutes(shift.startTime);
      if (late > settings.graceMinutes) {
        day.isLate = true;
        day.lateByMinutes = late;
      }
    }
    // A day still in progress cannot be short yet
    const finished = record.checkOut?.time || date < today;
    if (finished && scheduledMinutes && (record.workMinutes || 0) < (scheduledMinutes * settings.shortLoginPercent) / 100) {
      day.isShort = true;
    }
    if (leave?.isHalfDay) day.status = leaveStatus(leave.leaveType);
    else if (day.isLate) day.status = 'late-login';
    else if (day.isShort) day.status = 'short-login';
    else day.status = 'present';
  } else if (holiday) day.status = 'holiday';
  else if (shift.isWeeklyOff) day.status = 'weekly-off';
  else if (leave) day.status = leaveStatus(leave.leaveType);
  else if (date < today) day.status = 'absent';
  else day.status = 'scheduled';

  return day;
}

const ATTENDED = ['present', 'late-login', 'short-login'];

function summarize(days, settings) {
  const s = {
    scheduledDays: 0, // working days that have already happened
    present: 0,
    lateLogins: 0,
    shortLogins: 0,
    absent: 0,
    sickLeave: 0,
    emergencyLeave: 0,
    approvedLeave: 0,
    weeklyOffs: 0,
    holidays: 0,
    idleDays: 0,
    compliantDays: 0,
    loginMinutes: 0,
    scheduledMinutes: 0,
    adherentMinutes: 0, // minutes logged in inside the scheduled shift
    productiveMinutes: 0,
    idleMinutes: 0,
  };

  days.forEach((d) => {
    if (d.isLate) s.lateLogins += 1;
    if (d.isShort) s.shortLogins += 1;
    if (d.isIdle) s.idleDays += 1;
    if (d.status === 'absent') s.absent += 1;
    if (d.status === 'sick-leave') s.sickLeave += 1;
    if (d.status === 'emergency-leave') s.emergencyLeave += 1;
    if (d.status === 'approved-leave') s.approvedLeave += 1;
    if (d.status === 'weekly-off') s.weeklyOffs += 1;
    if (d.status === 'holiday') s.holidays += 1;

    if (ATTENDED.includes(d.status) || d.status === 'absent') {
      s.scheduledDays += 1;
      s.scheduledMinutes += d.scheduledMinutes;
    }
    if (ATTENDED.includes(d.status)) {
      s.present += 1;
      s.loginMinutes += d.loginMinutes;
      s.adherentMinutes += d.adherentMinutes;
      s.productiveMinutes += d.productiveMinutes || 0;
      s.idleMinutes += d.idleMinutes || 0;
      if (!d.isLate && !d.isShort) s.compliantDays += 1;
    }
  });

  const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
  s.attendancePercent = pct(s.present, s.scheduledDays);
  s.adherencePercent = pct(s.compliantDays, s.scheduledDays);
  s.loginHoursPercent = pct(s.loginMinutes, s.scheduledMinutes);
  s.scheduleAdherencePercent = pct(s.adherentMinutes, s.scheduledMinutes);
  s.meetsAdherenceTarget = s.adherencePercent === null ? null : s.adherencePercent >= settings.kpiTargets.adherence;
  return s;
}

/*
 * Month-by-month attendance / login / adherence trend for the last `months` months (current month included).
 * Returns { [userId]: [{ month: "YYYY-MM", ...summary }] } plus a combined "all" series.
 */
export async function getAdherenceTrend(users, settings, months = 3) {
  const today = todayInTz(settings.timezone);
  const [year, month] = today.split('-').map(Number);
  const ranges = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const range = monthRange(d.getUTCFullYear(), d.getUTCMonth() + 1);
    ranges.push({ month: range.start.slice(0, 7), start: range.start, end: range.end > today ? today : range.end });
  }

  const workforce = await getWorkforce(users, ranges[0].start, today, settings);
  const perUser = {};
  const allDays = ranges.map(() => []);

  Object.entries(workforce).forEach(([userId, { days }]) => {
    perUser[userId] = ranges.map((range, index) => {
      const monthDays = days.filter((d) => d.date >= range.start && d.date <= range.end);
      allDays[index].push(...monthDays);
      return { month: range.month, ...summarize(monthDays, settings) };
    });
  });

  const all = ranges.map((range, index) => ({ month: range.month, ...summarize(allDays[index], settings) }));
  return { perUser, all };
}

// Today and the next 13 days (2 weeks) for the roster view
export function twoWeekRange(settings) {
  const from = todayInTz(settings.timezone);
  return { from, to: addDays(from, 13) };
}
