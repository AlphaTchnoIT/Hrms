import { Attendance, LeaveRequest, Roster } from '../models/index.js';
import { buildHolidayLookup, findHolidays } from './calendar.service.js';
import { eachDate, monthRange, timeToMinutes, toDateStr, todayInTz, dayOfWeek } from '../utils/date.js';

// Decide present / half-day / absent based on worked minutes
export function getStatusFromMinutes(workMinutes, settings) {
  if (workMinutes >= settings.fullDayMinutes) return 'present';
  if (workMinutes >= settings.halfDayMinutes) return 'half-day';
  return 'absent';
}

// Late check-in? Returns minutes late after office start (0 if within grace time)
export function getLateMinutes(checkInMinutes, settings) {
  const officeStart = timeToMinutes(settings.officeStartTime);
  const isLate = checkInMinutes > officeStart + settings.graceMinutes;
  return isLate ? checkInMinutes - officeStart : 0;
}

/*
 * Loads everything needed to build monthly attendance for one or many employees in 3 queries.
 */
export async function loadMonthData(userIds, year, month) {
  const { start, end } = monthRange(year, month);
  const [records, holidays, leaves, rosters] = await Promise.all([
    Attendance.find({ user: { $in: userIds }, date: { $gte: start, $lte: end } }).sort('date'),
    findHolidays(start, end),
    LeaveRequest.find({
      user: { $in: userIds },
      status: 'approved',
      fromDate: { $lte: end },
      toDate: { $gte: start },
    }).populate('leaveType', 'name code color isPaid statutoryPay'),
    Roster.find({ user: { $in: userIds }, date: { $gte: start, $lte: end } }).select('user date isWeeklyOff'),
  ]);

  return { start, end, records, holidayOf: buildHolidayLookup(holidays), leaves, rosters };
}

/*
 * Builds the day-by-day attendance of one employee for a month.
 * Priority of a day: attendance record > holiday > weekly off > approved leave > absent.
 * Working days come from the roster when there is one; otherwise from the company weekly offs.
 * Part-time staff without a roster are never marked absent (we don't know which days they work).
 * Each day has `scheduled` = a working day for this person (bank holidays count as paid working days).
 */
export function buildMonthDays({ user, settings, start, end, records, holidayOf, leaves, rosters = [] }) {
  const today = todayInTz(settings.timezone);
  const joinDate = user.dateOfJoining ? toDateStr(user.dateOfJoining) : start;
  const exitDate = user.exitDate ? toDateStr(user.exitDate) : null;
  const userId = String(user._id);

  const recordMap = {};
  records.filter((r) => String(r.user) === userId).forEach((r) => (recordMap[r.date] = r));

  const leaveMap = {};
  leaves
    .filter((l) => String(l.user) === userId)
    .forEach((leave) => {
      eachDate(leave.fromDate, leave.toDate).forEach((date) => (leaveMap[date] = leave));
    });

  const rosterMap = {};
  rosters.filter((r) => String(r.user) === userId).forEach((r) => (rosterMap[r.date] = r));
  const partTimeWithoutRoster = (user.workingDaysPerWeek ?? 5) < 5 && !Object.keys(rosterMap).length;

  const days = eachDate(start, end).map((date) => {
    const record = recordMap[date] || null;
    const holiday = holidayOf(date, user.holidayRegion);
    const roster = rosterMap[date];
    const isWeeklyOff = roster ? roster.isWeeklyOff : settings.weeklyOffs.includes(dayOfWeek(date));
    const scheduled = !isWeeklyOff;
    const leave = leaveMap[date] || null;

    let status;
    if (date < joinDate || (exitDate && date > exitDate)) status = 'not-employed';
    else if (record) status = record.status;
    else if (holiday) status = 'holiday';
    else if (isWeeklyOff) status = 'weekly-off';
    else if (leave) status = 'leave';
    else if (partTimeWithoutRoster) status = 'weekly-off'; // non-working day of a part-timer
    else if (date < today) status = 'absent';
    else status = date === today ? 'today' : 'upcoming';

    return { date, status, record, holiday, isWeeklyOff, leave, scheduled };
  });

  return { days, summary: summarizeDays(days) };
}

function summarizeDays(days) {
  const summary = {
    present: 0,
    halfDay: 0,
    absent: 0,
    leave: 0,
    unpaidLeave: 0,
    holidays: 0,
    weeklyOffs: 0,
    late: 0,
    notEmployed: 0,
    totalWorkMinutes: 0,
  };

  days.forEach(({ status, record, leave }) => {
    if (record?.isLate) summary.late += 1;
    if (record) summary.totalWorkMinutes += record.workMinutes || 0;

    if (status === 'present') summary.present += 1;
    if (status === 'half-day') summary.halfDay += 1;
    if (status === 'absent') summary.absent += 1;
    if (status === 'holiday') summary.holidays += 1;
    if (status === 'weekly-off') summary.weeklyOffs += 1;
    if (status === 'not-employed') summary.notEmployed += 1;

    if (status === 'leave') {
      const value = leave.isHalfDay ? 0.5 : 1;
      summary.leave += value;
      if (!leave.leaveType?.isPaid) summary.unpaidLeave += value;
    }
  });

  return summary;
}


// Convenience wrapper for a single employee
export async function getMonthlyAttendance(user, year, month, settings) {
  const data = await loadMonthData([user._id], year, month);
  return buildMonthDays({ user, settings, ...data });
}
