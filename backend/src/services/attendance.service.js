import { Attendance, LeaveRequest } from '../models/index.js';
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
  const [records, holidays, leaves] = await Promise.all([
    Attendance.find({ user: { $in: userIds }, date: { $gte: start, $lte: end } }).sort('date'),
    findHolidays(start, end),
    LeaveRequest.find({
      user: { $in: userIds },
      status: 'approved',
      fromDate: { $lte: end },
      toDate: { $gte: start },
    }).populate('leaveType', 'name code color isPaid'),
  ]);

  return { start, end, records, holidayOf: buildHolidayLookup(holidays), leaves };
}

/*
 * Builds the day-by-day attendance of one employee for a month.
 * Priority of a day: attendance record > holiday > weekly off > approved leave > absent.
 */
export function buildMonthDays({ user, settings, start, end, records, holidayOf, leaves }) {
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

  const days = eachDate(start, end).map((date) => {
    const record = recordMap[date] || null;
    const holiday = holidayOf(date, user.holidayRegion);
    const isWeeklyOff = settings.weeklyOffs.includes(dayOfWeek(date));
    const leave = leaveMap[date] || null;

    let status;
    if (date < joinDate || (exitDate && date > exitDate)) status = 'not-employed';
    else if (record) status = record.status;
    else if (holiday) status = 'holiday';
    else if (isWeeklyOff) status = 'weekly-off';
    else if (leave) status = 'leave';
    else if (date < today) status = 'absent';
    else status = date === today ? 'today' : 'upcoming';

    return { date, status, record, holiday, isWeeklyOff, leave };
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

// Loss-of-pay days used by payroll
export function calculateLopDays(summary) {
  return summary.absent + summary.halfDay * 0.5 + summary.unpaidLeave + summary.notEmployed;
}

// Convenience wrapper for a single employee
export async function getMonthlyAttendance(user, year, month, settings) {
  const data = await loadMonthData([user._id], year, month);
  return buildMonthDays({ user, settings, ...data });
}
