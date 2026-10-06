import { Attendance, LeaveRequest, Regularization, Settings, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import {
  addDays,
  isValidDateStr,
  minutesOfDayInTz,
  toDateStr,
  timeToMinutes,
  todayInTz,
  zonedTimeToDate,
} from '../utils/date.js';
import {
  buildMonthDays,
  getLateMinutes,
  getMonthlyAttendance,
  getStatusFromMinutes,
  loadMonthData,
} from '../services/attendance.service.js';
import { canManageEmployee, getManagedUserFilter } from '../services/access.service.js';
import { notify } from '../services/notification.service.js';
import { endCurrentStatus, getDayLogs, getDefaultStatus, startStatus, summarize } from '../services/workStatus.service.js';

function getMonthYear(query) {
  const now = new Date();
  const month = Number(query.month) || now.getMonth() + 1;
  const year = Number(query.year) || now.getFullYear();
  if (month < 1 || month > 12) throw ApiError.badRequest('Invalid month');
  return { month, year };
}

function buildPunch(req) {
  const { latitude, longitude, note } = req.body || {};
  const hasLocation = typeof latitude === 'number' && typeof longitude === 'number';
  return {
    time: new Date(),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    location: hasLocation ? { latitude, longitude } : undefined,
    note,
  };
}

// Builds the mongo filter for "which employees can I see" + optional department filter
async function getVisibleEmployeeFilter(reqUser, query) {
  const filter = { status: 'active' };
  const managed = await getManagedUserFilter(reqUser, { scope: query.scope });
  if (managed) filter._id = managed;
  if (query.department) filter.department = query.department;
  return filter;
}

/* ---------------------------------- Web check-in / check-out ---------------------------------- */

// GET /api/attendance/today
export async function getToday(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const record = await Attendance.findOne({ user: req.user._id, date: today });

  sendSuccess(res, {
    data: {
      date: today,
      record,
      officeStartTime: settings.officeStartTime,
      officeEndTime: settings.officeEndTime,
      requireLocation: settings.requireLocationForCheckIn,
    },
  });
}

// POST /api/attendance/check-in
export async function checkIn(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);

  const existing = await Attendance.findOne({ user: req.user._id, date: today });
  if (existing?.checkIn?.time) throw ApiError.badRequest('You have already checked in today');

  const punch = buildPunch(req);
  if (settings.requireLocationForCheckIn && !punch.location) {
    throw ApiError.badRequest('Location access is required to check in');
  }

  const lateByMinutes = getLateMinutes(minutesOfDayInTz(settings.timezone), settings);
  const record = await Attendance.findOneAndUpdate(
    { user: req.user._id, date: today },
    { checkIn: punch, isLate: lateByMinutes > 0, lateByMinutes, status: 'present', source: 'web' },
    { new: true, upsert: true, runValidators: true }
  );

  // Start the day as "Available" on the Live Work Status
  const defaultStatus = settings.features?.workStatus !== false && getDefaultStatus(settings);
  if (defaultStatus) await startStatus(req.user._id, defaultStatus, { settings, at: punch.time });

  const message = lateByMinutes > 0 ? `Checked in (late by ${lateByMinutes} min)` : 'Checked in successfully';
  sendSuccess(res, { data: record, message, status: 201 });
}

// POST /api/attendance/check-out
export async function checkOut(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);

  const record = await Attendance.findOne({ user: req.user._id, date: today });
  if (!record?.checkIn?.time) throw ApiError.badRequest('You have not checked in today');
  if (record.checkOut?.time) throw ApiError.badRequest('You have already checked out today');

  const punch = buildPunch(req);
  if (settings.requireLocationForCheckIn && !punch.location) {
    throw ApiError.badRequest('Location access is required to check out');
  }

  record.checkOut = punch;
  record.workMinutes = Math.max(0, Math.round((punch.time - record.checkIn.time) / 60000));
  record.status = getStatusFromMinutes(record.workMinutes, settings);

  // End the work status and, unless the manager already entered them, fill AT / idle hours from it
  await endCurrentStatus(req.user._id, { at: punch.time, reason: 'check-out' });
  const logs = await getDayLogs(req.user._id, today);
  if (logs.length && record.productiveMinutes === undefined) {
    const { categories } = summarize(logs, punch.time);
    record.productiveMinutes = categories.productive;
    record.idleMinutes = categories.inactive;
  }
  await record.save();

  sendSuccess(res, { data: record, message: 'Checked out successfully' });
}

/* ---------------------------------- Attendance views ---------------------------------- */

// GET /api/attendance/my?month=&year=
export async function getMyAttendance(req, res) {
  const { month, year } = getMonthYear(req.query);
  const settings = await Settings.getSettings();
  const data = await getMonthlyAttendance(req.user, year, month, settings);
  sendSuccess(res, { data: { month, year, ...data } });
}

// GET /api/attendance/employee/:id?month=&year=  (HR / manager)
export async function getEmployeeAttendance(req, res) {
  if (!(await canManageEmployee(req.user, req.params.id))) throw ApiError.forbidden();

  const employee = await User.findById(req.params.id).select('firstName lastName employeeCode dateOfJoining exitDate');
  if (!employee) throw ApiError.notFound('Employee not found');

  const { month, year } = getMonthYear(req.query);
  const settings = await Settings.getSettings();
  const data = await getMonthlyAttendance(employee, year, month, settings);
  sendSuccess(res, { data: { month, year, employee, ...data } });
}

// GET /api/attendance/daily?date=YYYY-MM-DD  (HR / manager) - who is in today
export async function getDailyAttendance(req, res) {
  const settings = await Settings.getSettings();
  const date = isValidDateStr(req.query.date) ? req.query.date : todayInTz(settings.timezone);

  const employees = await User.find(await getVisibleEmployeeFilter(req.user, req.query))
    .select('firstName lastName employeeCode avatar department designation')
    .populate('department', 'name')
    .populate('designation', 'title')
    .sort('firstName');

  const ids = employees.map((e) => e._id);
  const [records, leaves] = await Promise.all([
    Attendance.find({ user: { $in: ids }, date }),
    LeaveRequest.find({ user: { $in: ids }, status: 'approved', fromDate: { $lte: date }, toDate: { $gte: date } })
      .populate('leaveType', 'name color'),
  ]);

  const recordMap = Object.fromEntries(records.map((r) => [String(r.user), r]));
  const leaveMap = Object.fromEntries(leaves.map((l) => [String(l.user), l]));

  const rows = employees.map((employee) => {
    const record = recordMap[String(employee._id)] || null;
    const leave = leaveMap[String(employee._id)] || null;
    let status = 'not-checked-in';
    if (record) status = record.checkOut?.time ? record.status : 'checked-in';
    else if (leave) status = 'on-leave';
    return { employee, record, leave, status };
  });

  const summary = {
    total: rows.length,
    checkedIn: rows.filter((r) => r.record).length,
    late: rows.filter((r) => r.record?.isLate).length,
    onLeave: rows.filter((r) => r.status === 'on-leave').length,
    notCheckedIn: rows.filter((r) => r.status === 'not-checked-in').length,
  };

  const statusFilter = req.query.status;
  sendSuccess(res, { data: { date, summary, rows: statusFilter ? rows.filter((r) => r.status === statusFilter) : rows } });
}

// GET /api/attendance/report?month=&year=  (HR / manager) - monthly summary per employee
export async function getMonthlyReport(req, res) {
  const { month, year } = getMonthYear(req.query);
  const settings = await Settings.getSettings();

  const employees = await User.find(await getVisibleEmployeeFilter(req.user, req.query))
    .select('firstName lastName employeeCode dateOfJoining exitDate department')
    .populate('department', 'name')
    .sort('firstName');

  const monthData = await loadMonthData(employees.map((e) => e._id), year, month);

  const rows = employees.map((employee) => {
    const { summary } = buildMonthDays({ user: employee, settings, ...monthData });
    return { employee, summary };
  });

  sendSuccess(res, { data: { month, year, rows } });
}

/* ---------------------------------- Regularization ---------------------------------- */

// POST /api/attendance/regularizations
export async function applyRegularization(req, res) {
  const { date, checkInTime, checkOutTime, reason } = req.body;
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);

  if (date > today) throw ApiError.field('date', 'You cannot regularise a future date');
  if (date < addDays(today, -30)) throw ApiError.field('date', 'Regularisation is allowed only for the last 30 days');
  if (date < toDateStr(req.user.dateOfJoining)) throw ApiError.field('date', 'Date is before your joining date');

  const duplicate = await Regularization.findOne({ user: req.user._id, date, status: 'pending' });
  if (duplicate) throw ApiError.field('date', 'A regularisation request for this date is already pending');

  const request = await Regularization.create({ user: req.user._id, date, checkInTime, checkOutTime, reason });

  notify(req.user.reportingManager, {
    title: 'Attendance regularisation request',
    message: `${req.user.fullName} requested regularisation for ${date}`,
    link: '/team/regularizations',
  });

  sendSuccess(res, { data: request, message: 'Regularisation request submitted', status: 201 });
}

// GET /api/attendance/regularizations/my
export async function getMyRegularizations(req, res) {
  const requests = await Regularization.find({ user: req.user._id })
    .populate('reviewedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(100);
  sendSuccess(res, { data: requests });
}

// GET /api/attendance/regularizations?status=pending  (HR / manager)
export async function listRegularizations(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const managed = await getManagedUserFilter(req.user, { scope: req.query.scope });
  if (managed) filter.user = managed;

  const [items, total] = await Promise.all([
    Regularization.find(filter)
      .populate('user', 'firstName lastName employeeCode avatar')
      .populate('reviewedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Regularization.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
}

// PATCH /api/attendance/regularizations/:id/review  { action: 'approve' | 'reject', note }
export async function reviewRegularization(req, res) {
  const { action, note } = req.body;
  if (!['approve', 'reject'].includes(action)) throw ApiError.badRequest('Action must be approve or reject');

  const request = await Regularization.findById(req.params.id);
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'pending') throw ApiError.badRequest('This request has already been reviewed');
  if (String(request.user) === String(req.user._id)) throw ApiError.forbidden('You cannot review your own request');
  if (!(await canManageEmployee(req.user, request.user))) throw ApiError.forbidden();

  if (action === 'approve') {
    const settings = await Settings.getSettings();
    const checkInAt = zonedTimeToDate(request.date, request.checkInTime, settings.timezone);
    const checkOutAt = zonedTimeToDate(request.date, request.checkOutTime, settings.timezone);
    const workMinutes = Math.round((checkOutAt - checkInAt) / 60000);
    const lateByMinutes = getLateMinutes(timeToMinutes(request.checkInTime), settings);

    await Attendance.findOneAndUpdate(
      { user: request.user, date: request.date },
      {
        checkIn: { time: checkInAt, note: 'Regularised' },
        checkOut: { time: checkOutAt, note: 'Regularised' },
        workMinutes,
        status: getStatusFromMinutes(workMinutes, settings),
        isLate: lateByMinutes > 0,
        lateByMinutes,
        source: 'regularization',
        remarks: request.reason,
      },
      { upsert: true, runValidators: true }
    );
  }

  request.status = action === 'approve' ? 'approved' : 'rejected';
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();
  request.reviewNote = note;
  await request.save();

  notify(request.user, {
    title: `Regularisation ${request.status}`,
    message: `Your regularisation request for ${request.date} was ${request.status}`,
    link: '/attendance',
  });

  sendSuccess(res, { data: request, message: `Request ${request.status}` });
}

// PATCH /api/attendance/regularizations/:id/cancel
export async function cancelRegularization(req, res) {
  const request = await Regularization.findOne({ _id: req.params.id, user: req.user._id });
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'pending') throw ApiError.badRequest('Only pending requests can be cancelled');

  request.status = 'cancelled';
  await request.save();
  sendSuccess(res, { data: request, message: 'Request cancelled' });
}
