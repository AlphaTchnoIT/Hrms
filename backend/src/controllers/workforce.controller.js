import { Attendance, MonthlyHours, PayrollRun, Roster, Settings, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { addDays, dayOfWeek, eachDate, isValidDateStr, monthRange, toDateStr, todayInTz } from '../utils/date.js';
import { canManageEmployee, getScopedUsers } from '../services/access.service.js';
import { getAdherenceTrend, getWorkforce, twoWeekRange } from '../services/workforce.service.js';
import { notifyMany } from '../services/notification.service.js';

const MAX_RANGE_DAYS = 93;

// from/to from the query, defaulting to `fallback`; rejects ranges that are too long
function readRange(query, fallback) {
  const from = isValidDateStr(query.from) ? query.from : fallback.from;
  const to = isValidDateStr(query.to) ? query.to : fallback.to;
  if (to < from) throw ApiError.badRequest('"To" date cannot be before "from" date');
  if (eachDate(from, to).length > MAX_RANGE_DAYS) throw ApiError.badRequest(`Please select at most ${MAX_RANGE_DAYS} days`);
  return { from, to };
}

function currentMonth(settings) {
  const today = todayInTz(settings.timezone);
  const { start } = monthRange(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
  return { from: start, to: today };
}

// HR/manager looking at one employee, or the whole visible team
async function resolveUsers(req) {
  if (req.query.user) {
    if (!(await canManageEmployee(req.user, req.query.user))) throw ApiError.forbidden();
    const user = await User.findById(req.query.user).select('firstName lastName employeeCode avatar dateOfJoining reportingManager');
    if (!user) throw ApiError.notFound('Employee not found');
    return [user];
  }
  return getScopedUsers(req.user, { scope: req.query.scope, managerId: req.query.manager });
}

// GET /api/workforce/roster/my - shifts, weekly offs and hours for the next two weeks
export async function getMyRoster(req, res) {
  const settings = await Settings.getSettings();
  const range = readRange(req.query, twoWeekRange(settings));
  const workforce = await getWorkforce([req.user], range.from, range.to, settings);
  const { days } = workforce[String(req.user._id)] || { days: [] };
  const scheduledMinutes = days.reduce((sum, d) => sum + d.scheduledMinutes, 0);
  sendSuccess(res, { data: { ...range, days, scheduledMinutes } });
}

// GET /api/workforce/roster?from&to&manager - team roster grid
export async function getTeamRoster(req, res) {
  const settings = await Settings.getSettings();
  const range = readRange(req.query, twoWeekRange(settings));
  const users = await resolveUsers(req);
  const workforce = await getWorkforce(users, range.from, range.to, settings);
  const members = users.map((user) => ({ user, days: workforce[String(user._id)]?.days || [] }));
  sendSuccess(res, { data: { ...range, dates: eachDate(range.from, range.to), members } });
}

// POST /api/workforce/roster/bulk - assign a shift pattern to several employees for a date range
export async function assignRoster(req, res) {
  const { users, from, to, shiftName, startTime, endTime, weeklyOffDays = [], notes } = req.body;
  if (eachDate(from, to).length > 62) throw ApiError.field('to', 'A roster can cover at most 62 days at a time');

  for (const userId of users) {
    if (!(await canManageEmployee(req.user, userId))) throw ApiError.forbidden('You can only roster your own team members');
  }

  const operations = [];
  users.forEach((user) =>
    eachDate(from, to).forEach((date) => {
      operations.push({
        updateOne: {
          filter: { user, date },
          update: {
            $set: {
              shiftName,
              startTime,
              endTime,
              isWeeklyOff: weeklyOffDays.includes(dayOfWeek(date)),
              notes,
              createdBy: req.user._id,
            },
          },
          upsert: true,
        },
      });
    })
  );
  await Roster.bulkWrite(operations);

  notifyMany(users, {
    title: 'Roster updated',
    message: `Your ${shiftName} shift (${startTime}-${endTime}) is published from ${from} to ${to}`,
    link: '/roster',
  });

  sendSuccess(res, { message: `Roster saved for ${users.length} employee(s)`, data: { entries: operations.length } });
}

// POST /api/workforce/roster/clear - remove roster entries (days fall back to office timings)
export async function clearRoster(req, res) {
  const { users, from, to } = req.body;
  for (const userId of users) {
    if (!(await canManageEmployee(req.user, userId))) throw ApiError.forbidden();
  }
  const result = await Roster.deleteMany({ user: { $in: users }, date: { $gte: from, $lte: to } });
  sendSuccess(res, { message: `${result.deletedCount} roster entries removed` });
}

// GET /api/workforce/attendance/my?from&to - attendance tracking with detailed statuses
export async function getMyAttendanceStatus(req, res) {
  const settings = await Settings.getSettings();
  const range = readRange(req.query, currentMonth(settings));
  const workforce = await getWorkforce([req.user], range.from, range.to, settings);
  sendSuccess(res, { data: { ...range, ...workforce[String(req.user._id)] } });
}

// GET /api/workforce/login-hours?from&to&manager&user - login / AT hours of the team
export async function getLoginHours(req, res) {
  const settings = await Settings.getSettings();
  const yesterday = addDays(todayInTz(settings.timezone), -1);
  const range = readRange(req.query, { from: yesterday, to: yesterday });
  const users = await resolveUsers(req);
  const workforce = await getWorkforce(users, range.from, range.to, settings);

  const rows = users.map((user) => ({ user, ...workforce[String(user._id)] }));
  sendSuccess(res, {
    data: { ...range, rows, idleAlertMinutes: settings.idleAlertMinutes, shortLoginPercent: settings.shortLoginPercent },
  });
}

// PUT /api/workforce/login-hours - manager records productive (AT) and idle minutes for a day
export async function updateLoginHours(req, res) {
  const { user, date, productiveMinutes, idleMinutes } = req.body;
  if (!(await canManageEmployee(req.user, user))) throw ApiError.forbidden();

  const record = await Attendance.findOne({ user, date });
  if (!record) throw ApiError.badRequest('There is no login for this employee on that date');
  if (productiveMinutes + idleMinutes > Math.max(record.workMinutes, 1) + 60) {
    throw ApiError.field('productiveMinutes', 'Productive + idle time cannot be much more than the login time');
  }

  record.productiveMinutes = productiveMinutes;
  record.idleMinutes = idleMinutes;
  await record.save();
  await flagPayrollRerun(user, Number(date.slice(5, 7)), Number(date.slice(0, 4)));
  sendSuccess(res, { data: record, message: 'Login hours updated' });
}

// GET /api/workforce/trends?months=3 (own) or with ?user / ?manager for team views
export async function getTrends(req, res) {
  const settings = await Settings.getSettings();
  const months = Math.min(Math.max(Number(req.query.months) || 3, 1), 12);
  const forSelf = !req.query.user && !req.query.manager && req.query.scope !== 'team';
  const users = forSelf ? [req.user] : await resolveUsers(req);
  if (!users.length) return sendSuccess(res, { data: { all: [], members: [] } });

  const { perUser, all } = await getAdherenceTrend(users, settings, months);
  const members = users.map((user) => ({ user, months: perUser[String(user._id)] || [] }));
  sendSuccess(res, { data: { all, members, adherenceTarget: settings.kpiTargets.adherence } });
}

// Hourly pay depends on AT hours: a processed (not yet paid) payroll of that month must be re-run
async function flagPayrollRerun(userId, month, year) {
  if (!(await User.exists({ _id: userId, 'salary.payType': 'hourly' }))) return;
  await PayrollRun.updateOne({ month, year, status: 'processed' }, { needsRerun: true });
}

// Month / year from the query, defaulting to the current month
function readMonth(query, settings) {
  const today = todayInTz(settings.timezone);
  const month = Number(query.month) || Number(today.slice(5, 7));
  const year = Number(query.year) || Number(today.slice(0, 4));
  if (month < 1 || month > 12 || year < 2000 || year > 2100) throw ApiError.badRequest('Select a valid month');
  return { month, year };
}

// GET /api/workforce/monthly-hours?month&year&scope&manager - monthly AT hours of the team (one number per person)
export async function getMonthlyHours(req, res) {
  const settings = await Settings.getSettings();
  const { month, year } = readMonth(req.query, settings);
  const { start, end } = monthRange(year, month);
  const users = await resolveUsers(req);
  const [workforce, entries, run, payTypes] = await Promise.all([
    getWorkforce(users, start, end, settings),
    MonthlyHours.find({ month, year, user: { $in: users.map((u) => u._id) } }).populate('enteredBy', 'firstName lastName'),
    PayrollRun.findOne({ month, year }).select('status'),
    // Only the pay type (not the pay) so managers know who is paid by the hour
    User.find({ _id: { $in: users.map((u) => u._id) } }).select('salary.payType').lean(),
  ]);
  const entryOf = new Map(entries.map((e) => [String(e.user), e]));
  const hourlyIds = new Set(payTypes.filter((u) => u.salary?.payType === 'hourly').map((u) => String(u._id)));

  const rows = users.map((user) => {
    const summary = workforce[String(user._id)]?.summary;
    const entry = entryOf.get(String(user._id));
    return {
      user,
      hourly: hourlyIds.has(String(user._id)),
      loginMinutes: summary?.loginMinutes || 0,
      dailyProductiveMinutes: summary?.productiveMinutes || 0,
      monthlyMinutes: entry ? entry.productiveMinutes : null,
      note: entry?.note || '',
      enteredBy: entry?.enteredBy || null,
      updatedAt: entry?.updatedAt || null,
    };
  });
  sendSuccess(res, { data: { month, year, locked: run?.status === 'paid', needsRerun: Boolean(run?.needsRerun), rows } });
}

// PUT /api/workforce/monthly-hours { user, month, year, hours, note } - hours = null clears the entry
export async function updateMonthlyHours(req, res) {
  const { user, month, year, hours, note } = req.body;
  if (!(await canManageEmployee(req.user, user))) throw ApiError.forbidden();

  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  if (year * 100 + month > Number(today.slice(0, 4)) * 100 + Number(today.slice(5, 7))) {
    throw ApiError.field('month', 'Hours cannot be entered for a future month');
  }
  if ((await PayrollRun.findOne({ month, year }).select('status'))?.status === 'paid') {
    throw ApiError.badRequest('Payroll for this month is paid, hours are locked');
  }

  if (hours === null) {
    await MonthlyHours.deleteOne({ user, month, year });
    await flagPayrollRerun(user, month, year);
    return sendSuccess(res, { message: 'Monthly hours cleared, payroll will use the daily AT hours' });
  }

  const employee = await User.findById(user).select('salary.payType dateOfJoining exitDate');
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.salary?.payType !== 'hourly') throw ApiError.badRequest('Monthly AT hours are only used for hourly-paid employees');
  const { start, end } = monthRange(year, month);
  if (employee.dateOfJoining && toDateStr(employee.dateOfJoining) > end) throw ApiError.field('month', 'The employee had not joined yet in this month');
  if (employee.exitDate && toDateStr(employee.exitDate) < start) throw ApiError.field('month', 'The employee had left before this month');
  const entry = await MonthlyHours.findOneAndUpdate(
    { user, month, year },
    { $set: { productiveMinutes: Math.round(hours * 60), note, enteredBy: req.user._id } },
    { upsert: true, new: true, runValidators: true }
  );
  await flagPayrollRerun(user, month, year);
  sendSuccess(res, { data: entry, message: 'Monthly AT hours saved' });
}
