import { LeaveBalance, LeaveRequest, LeaveType, Settings } from '../models/index.js';
import { pick } from '../utils/helpers.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { addDays, isValidDateStr, todayInTz } from '../utils/date.js';
import { getWorkingDates } from '../services/calendar.service.js';
import { adjustBalance, getBalancesForUser, getOrCreateBalance } from '../services/leave.service.js';
import { canManageEmployee, getManagedUserFilter } from '../services/access.service.js';
import { notify } from '../services/notification.service.js';

const yearOf = (dateStr) => Number(dateStr.slice(0, 4));

const LEAVE_POPULATE = [
  { path: 'user', select: 'firstName lastName employeeCode avatar' },
  { path: 'leaveType', select: 'name code color isPaid' },
  { path: 'reviewedBy', select: 'firstName lastName' },
];

/* ---------------------------------- Balances ---------------------------------- */

// GET /api/leaves/balances?year=
export async function getMyBalances(req, res) {
  const year = Number(req.query.year) || new Date().getFullYear();
  sendSuccess(res, { data: await getBalancesForUser(req.user._id, year) });
}

// GET /api/leaves/balances/:userId?year=  (HR / manager)
export async function getEmployeeBalances(req, res) {
  if (!(await canManageEmployee(req.user, req.params.userId))) throw ApiError.forbidden();
  const year = Number(req.query.year) || new Date().getFullYear();
  sendSuccess(res, { data: await getBalancesForUser(req.params.userId, year) });
}

// PUT /api/leaves/balances/:userId  { leaveType, year, allocated }  (HR)
export async function updateEmployeeBalance(req, res) {
  const { leaveType, allocated } = req.body;
  const year = req.body.year || new Date().getFullYear();

  const balance = await getOrCreateBalance(req.params.userId, leaveType, year);
  if (allocated < balance.used + balance.pending) {
    throw ApiError.field('allocated', `Cannot be less than days already used or pending (${balance.used + balance.pending})`);
  }
  balance.allocated = allocated;
  await balance.save();
  sendSuccess(res, { data: balance, message: 'Leave balance updated' });
}

/* ---------------------------------- Requests ---------------------------------- */

// POST /api/leaves
export async function applyLeave(req, res) {
  const { leaveType: leaveTypeId, fromDate, reason, halfDaySession } = req.body;
  const isHalfDay = Boolean(req.body.isHalfDay);
  const toDate = isHalfDay ? fromDate : req.body.toDate;

  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  if (fromDate < addDays(today, -60)) throw ApiError.field('fromDate', 'Leave cannot be applied for dates older than 60 days');
  if (fromDate > addDays(today, 365)) throw ApiError.field('fromDate', 'Leave can be applied up to one year in advance');

  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType || !leaveType.isActive) throw ApiError.field('leaveType', 'Please select a valid leave type');
  if (isHalfDay && !leaveType.allowHalfDay) throw ApiError.field('isHalfDay', `${leaveType.name} cannot be taken as half day`);

  const workingDates = await getWorkingDates(fromDate, toDate, settings);
  if (!workingDates.length) throw ApiError.field('fromDate', 'Selected dates fall on holidays / weekly offs');
  const days = isHalfDay ? 0.5 : workingDates.length;

  const overlap = await LeaveRequest.findOne({
    user: req.user._id,
    status: { $in: ['pending', 'approved'] },
    fromDate: { $lte: toDate },
    toDate: { $gte: fromDate },
  });
  if (overlap) throw ApiError.field('fromDate', 'You already have a leave request overlapping these dates');

  const year = yearOf(fromDate);
  if (leaveType.isPaid) {
    const balance = await getOrCreateBalance(req.user._id, leaveType._id, year);
    if (balance.available < days) {
      throw ApiError.field('leaveType', `Insufficient ${leaveType.name} balance. Available: ${balance.available} day(s)`);
    }
  }

  const leave = await LeaveRequest.create({
    user: req.user._id,
    leaveType: leaveType._id,
    fromDate,
    toDate,
    isHalfDay,
    halfDaySession: isHalfDay ? halfDaySession || 'first-half' : null,
    days,
    reason,
  });
  await adjustBalance(req.user._id, leaveType._id, year, { pending: days });

  notify(req.user.reportingManager, {
    title: 'New leave request',
    message: `${req.user.fullName} applied for ${days} day(s) of ${leaveType.name}`,
    link: '/team/leave-approvals',
  });

  sendSuccess(res, { data: leave, message: 'Leave applied successfully', status: 201 });
}

// GET /api/leaves/my?status=&year=
export async function getMyLeaves(req, res) {
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.year) filter.fromDate = { $gte: `${req.query.year}-01-01`, $lte: `${req.query.year}-12-31` };

  const leaves = await LeaveRequest.find(filter).populate(LEAVE_POPULATE).sort({ fromDate: -1 }).limit(200);
  sendSuccess(res, { data: leaves });
}

// GET /api/leaves?status=pending  (HR / manager)
export async function listLeaves(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.leaveType) filter.leaveType = req.query.leaveType;

  const managed = await getManagedUserFilter(req.user);
  if (managed) filter.user = managed;
  if (req.query.user) {
    if (!(await canManageEmployee(req.user, req.query.user))) throw ApiError.forbidden();
    filter.user = req.query.user;
  }

  const [items, total] = await Promise.all([
    LeaveRequest.find(filter).populate(LEAVE_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    LeaveRequest.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
}

// GET /api/leaves/who-is-out?date=  - approved leaves on a date (visible to everyone)
export async function getWhoIsOut(req, res) {
  const settings = await Settings.getSettings();
  const date = isValidDateStr(req.query.date) ? req.query.date : todayInTz(settings.timezone);

  const leaves = await LeaveRequest.find({ status: 'approved', fromDate: { $lte: date }, toDate: { $gte: date } })
    .populate('user', 'firstName lastName avatar employeeCode')
    .populate('leaveType', 'name color');
  sendSuccess(res, { data: leaves });
}

// PATCH /api/leaves/:id/review  { action: 'approve' | 'reject', note }
export async function reviewLeave(req, res) {
  const { action, note } = req.body;
  if (!['approve', 'reject'].includes(action)) throw ApiError.badRequest('Action must be approve or reject');

  const leave = await LeaveRequest.findById(req.params.id).populate('leaveType', 'name');
  if (!leave) throw ApiError.notFound('Leave request not found');
  if (leave.status !== 'pending') throw ApiError.badRequest('This leave has already been reviewed');
  if (String(leave.user) === String(req.user._id)) throw ApiError.forbidden('You cannot approve your own leave');
  if (!(await canManageEmployee(req.user, leave.user))) throw ApiError.forbidden();

  const year = yearOf(leave.fromDate);
  if (action === 'approve') {
    await adjustBalance(leave.user, leave.leaveType._id, year, { pending: -leave.days, used: leave.days });
    leave.status = 'approved';
  } else {
    await adjustBalance(leave.user, leave.leaveType._id, year, { pending: -leave.days });
    leave.status = 'rejected';
  }
  leave.reviewedBy = req.user._id;
  leave.reviewedAt = new Date();
  leave.reviewNote = note;
  await leave.save();

  notify(leave.user, {
    title: `Leave ${leave.status}`,
    message: `Your ${leave.leaveType.name} from ${leave.fromDate} to ${leave.toDate} was ${leave.status}`,
    link: '/leave',
  });

  sendSuccess(res, { data: leave, message: `Leave ${leave.status}` });
}

// PATCH /api/leaves/:id/cancel - pending leaves, or approved leaves that haven't started yet
export async function cancelLeave(req, res) {
  const leave = await LeaveRequest.findOne({ _id: req.params.id, user: req.user._id });
  if (!leave) throw ApiError.notFound('Leave request not found');

  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const year = yearOf(leave.fromDate);

  if (leave.status === 'pending') {
    await adjustBalance(leave.user, leave.leaveType, year, { pending: -leave.days });
  } else if (leave.status === 'approved' && leave.fromDate > today) {
    await adjustBalance(leave.user, leave.leaveType, year, { used: -leave.days });
  } else {
    throw ApiError.badRequest('This leave can no longer be cancelled');
  }

  leave.status = 'cancelled';
  await leave.save();
  sendSuccess(res, { data: leave, message: 'Leave cancelled' });
}

/* ---------------------------------- Leave types ---------------------------------- */

const LEAVE_TYPE_FIELDS = ['name', 'code', 'annualQuota', 'isPaid', 'allowHalfDay', 'color', 'description', 'isActive'];

export async function listLeaveTypes(req, res) {
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  sendSuccess(res, { data: await LeaveType.find(filter).sort('name') });
}

export async function createLeaveType(req, res) {
  const body = pick(req.body, LEAVE_TYPE_FIELDS);
  const leaveType = await LeaveType.create(body);
  sendSuccess(res, { data: leaveType, message: 'Leave type created', status: 201 });
}

export async function updateLeaveType(req, res) {
  const body = pick(req.body, LEAVE_TYPE_FIELDS);
  const leaveType = await LeaveType.findById(req.params.id);
  if (!leaveType) throw ApiError.notFound('Leave type not found');

  const quotaChanged = body.annualQuota !== undefined && Number(body.annualQuota) !== leaveType.annualQuota;
  leaveType.set(body);
  await leaveType.save();

  // Apply the new quota to everyone's current-year balance
  if (quotaChanged) {
    await LeaveBalance.updateMany(
      { leaveType: leaveType._id, year: new Date().getFullYear() },
      { allocated: leaveType.annualQuota }
    );
  }

  sendSuccess(res, { data: leaveType, message: 'Leave type updated' });
}

export async function deleteLeaveType(req, res) {
  const used = await LeaveRequest.countDocuments({ leaveType: req.params.id });
  if (used) {
    // Keep history safe: deactivate instead of deleting
    await LeaveType.findByIdAndUpdate(req.params.id, { isActive: false });
    return sendSuccess(res, { message: 'Leave type is in use, so it was deactivated instead' });
  }
  await LeaveType.findByIdAndDelete(req.params.id);
  await LeaveBalance.deleteMany({ leaveType: req.params.id });
  sendSuccess(res, { message: 'Leave type deleted' });
}
