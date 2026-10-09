import { Settings, User, generateCode } from '../models/index.js';
import { ROLES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { buildMeta, escapeRegex, getPagination } from '../utils/pagination.js';
import { emptyToNull, pick } from '../utils/helpers.js';
import { generateTemporaryPassword } from '../utils/password.js';
import { anonymiseAllowedFrom, anonymiseEmployee, buildPersonalDataExport } from '../services/gdpr.service.js';
import { todayInTz } from '../utils/date.js';
import { canManageEmployee, getTeamMemberIds, isHR, wouldCreateReportingLoop } from '../services/access.service.js';
import { disconnectUser } from '../chat/chat.socket.js';

export const USER_POPULATE = [
  { path: 'department', select: 'name code' },
  { path: 'designation', select: 'title' },
  { path: 'reportingManager', select: 'firstName lastName email employeeCode avatar' },
];

// Fields HR can set while creating / editing an employee
const EMPLOYEE_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'role',
  'phone',
  'gender',
  'dateOfBirth',
  'maritalStatus',
  'bloodGroup',
  'avatar',
  'address',
  'emergencyContact',
  'department',
  'designation',
  'reportingManager',
  'employmentType',
  'dateOfJoining',
  'workLocation',
  'holidayRegion',
  'workingDaysPerWeek',
  'contractedHoursPerWeek',
  'noticePeriodWeeks',
  'wtrOptOut',
  'probationEndDate',
  'rightToWork',
  'status',
  'exitDate',
  'niNumber',
  'bankDetails',
  'salary',
];

const REF_FIELDS = ['department', 'designation', 'reportingManager'];
const SENSITIVE_FIELDS = ['salary', 'monthlyGross', 'bankDetails', 'niNumber'];

function buildEmployeeFilter(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = query.department;
  if (query.designation) filter.designation = query.designation;
  if (query.role) filter.role = query.role;
  // role=manager also lists people leads (anyone with active reportees), e.g. team leads
  if (query.role === ROLES.MANAGER) {
    delete filter.role;
    filter.$and = [{ $or: [{ role: ROLES.MANAGER }, { _id: { $in: query.leadIds || [] } }] }];
  }
  if (query.employmentType) filter.employmentType = query.employmentType;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }, { employeeCode: regex }];
  }
  return filter;
}

// HR cannot create or promote someone to admin
function assertRoleAllowed(currentUser, role) {
  if (role === ROLES.ADMIN && currentUser.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only an admin can assign the admin role');
  }
}

// GET /api/employees  (HR)
export async function listEmployees(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = buildEmployeeFilter(req.query);

  const [employees, total] = await Promise.all([
    User.find(filter).populate(USER_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  sendSuccess(res, { data: employees, meta: buildMeta({ page, limit, total }) });
}

// IDs of everyone who has at least one active direct report
function getPeopleLeadIds() {
  return User.find({ status: 'active', reportingManager: { $ne: null } }).distinct('reportingManager');
}

// GET /api/employees/directory  (everyone) - limited public info of active employees
export async function getDirectory(req, res) {
  const { page, limit, skip } = getPagination({ limit: 50, ...req.query });
  const leadIds = req.query.role === ROLES.MANAGER ? await getPeopleLeadIds() : undefined;
  const filter = { ...buildEmployeeFilter({ ...req.query, leadIds }), status: 'active' };

  const [employees, total] = await Promise.all([
    User.find(filter)
      .select('firstName lastName email phone employeeCode avatar department designation workLocation role')
      .populate(USER_POPULATE.slice(0, 2))
      .sort({ firstName: 1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  sendSuccess(res, { data: employees, meta: buildMeta({ page, limit, total }) });
}

/*
 * GET /api/employees/org-chart  (everyone)
 * Every active employee with only public fields + who they report to; the frontend builds the tree.
 */
export async function getOrgChart(_req, res) {
  const people = await User.find({ status: 'active' })
    .select('firstName lastName employeeCode avatar email role department designation reportingManager workLocation')
    .populate(USER_POPULATE.slice(0, 2))
    .sort({ firstName: 1 })
    .lean();
  const activeIds = new Set(people.map((p) => String(p._id)));
  const data = people.map((p) => ({
    ...p,
    // A manager who left is treated as "no manager" so the person still shows up in the chart
    reportingManager: p.reportingManager && activeIds.has(String(p.reportingManager)) ? p.reportingManager : null,
  }));
  sendSuccess(res, { data });
}

// GET /api/employees/team?scope=direct|all  (manager / team lead) - own reportees
export async function getMyTeam(req, res) {
  const filter = req.query.scope === 'all' ? { _id: { $in: await getTeamMemberIds(req.user._id, { scope: 'all' }) } } : { reportingManager: req.user._id };
  const team = await User.find({ ...filter, status: 'active' })
    .select('-salary -bankDetails -niNumber')
    .populate(USER_POPULATE)
    .sort({ firstName: 1 });
  sendSuccess(res, { data: team });
}

// GET /api/employees/:id
export async function getEmployee(req, res) {
  const { id } = req.params;
  const isSelf = String(req.user._id) === id;

  if (!isSelf && !(await canManageEmployee(req.user, id))) throw ApiError.forbidden();

  const employee = await User.findById(id).populate(USER_POPULATE);
  if (!employee) throw ApiError.notFound('Employee not found');

  const data = employee.toJSON();
  // Managers should not see salary or bank details of their team
  if (!isSelf && !isHR(req.user)) SENSITIVE_FIELDS.forEach((field) => delete data[field]);

  sendSuccess(res, { data });
}

// POST /api/employees  (HR)
export async function createEmployee(req, res) {
  const body = emptyToNull(pick(req.body, EMPLOYEE_FIELDS), REF_FIELDS);
  assertRoleAllowed(req.user, body.role);

  // No shared default password: HR sets one or gets a random one to pass on; either way it must be changed at first login
  const temporaryPassword = req.body.password || generateTemporaryPassword();
  if (await User.exists({ email: body.email })) throw ApiError.field('email', 'An employee with this email already exists');

  if (body.reportingManager && !(await User.exists({ _id: body.reportingManager, status: 'active' }))) {
    throw ApiError.field('reportingManager', 'Select an active employee as reporting manager');
  }

  const employeeCode = await generateCode('employee', 'EMP');
  const employee = await User.create({ ...body, password: temporaryPassword, mustChangePassword: true, employeeCode });

  const populated = await User.findById(employee._id).populate(USER_POPULATE);
  sendSuccess(res, {
    data: { ...populated.toJSON(), temporaryPassword: req.body.password ? undefined : temporaryPassword },
    message: `Employee ${employeeCode} created`,
    status: 201,
  });
}

// PUT /api/employees/:id  (HR)
export async function updateEmployee(req, res) {
  const body = emptyToNull(pick(req.body, EMPLOYEE_FIELDS), REF_FIELDS);
  assertRoleAllowed(req.user, body.role);

  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');

  if (employee.role === ROLES.ADMIN && req.user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only an admin can edit an admin account');
  }
  if (body.reportingManager && String(body.reportingManager) === String(employee._id)) {
    throw ApiError.field('reportingManager', 'An employee cannot report to themselves');
  }
  // e.g. a manager cannot report to their own team lead
  if (body.reportingManager && (await wouldCreateReportingLoop(employee._id, body.reportingManager))) {
    throw ApiError.field('reportingManager', 'This person already reports to this employee (directly or indirectly)');
  }
  if (body.email && body.email !== employee.email && (await User.exists({ email: body.email }))) {
    throw ApiError.field('email', 'An employee with this email already exists');
  }

  // Merge nested objects so a partial update doesn't wipe other keys
  ['address', 'emergencyContact', 'bankDetails', 'salary', 'rightToWork'].forEach((key) => {
    if (body[key]) body[key] = { ...(employee[key]?.toObject?.() || {}), ...body[key] };
  });

  employee.set(body);
  await employee.save();
  if (employee.status !== 'active') disconnectUser(employee._id); // leavers lose live chat straight away

  const populated = await User.findById(employee._id).populate(USER_POPULATE);
  sendSuccess(res, { data: populated, message: 'Employee updated' });
}

// GET /api/employees/:id/export  (HR) - all personal data held about the employee (subject access request)
export async function exportEmployeeData(req, res) {
  const data = await buildPersonalDataExport(req.params.id);
  if (!data) throw ApiError.notFound('Employee not found');
  sendSuccess(res, { data });
}

/*
 * POST /api/employees/:id/anonymise  (HR) - UK GDPR: remove a leaver's personal details
 * once the retention period (Settings -> data retention, default 6 years) has passed since they left.
 */
export async function anonymiseLeaver(req, res) {
  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.anonymisedAt) throw ApiError.badRequest('This employee is already anonymised');
  if (employee.status === 'active' || !employee.exitDate) throw ApiError.badRequest('Only leavers with an exit date can be anonymised');
  if (employee.role === ROLES.ADMIN && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden();

  const settings = await Settings.getSettings();
  const allowedFrom = anonymiseAllowedFrom(employee, settings.dataRetentionYears || 6);
  if (allowedFrom > todayInTz(settings.timezone)) {
    throw ApiError.badRequest(`Records must be kept until ${allowedFrom} (${settings.dataRetentionYears} years after leaving)`);
  }
  await anonymiseEmployee(employee);
  sendSuccess(res, { message: 'Personal details removed. Anonymous records are kept for reporting.' });
}

// PATCH /api/employees/:id/reset-password  (HR)
export async function resetPassword(req, res) {
  const { newPassword } = req.body;

  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.role === ROLES.ADMIN && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden();

  employee.password = newPassword;
  employee.mustChangePassword = true; // they choose their own at next login
  await employee.save();
  sendSuccess(res, { message: 'Password reset. They will be asked to choose a new one when they log in.' });
}

// DELETE /api/employees/:id  (HR) - soft delete: marks employee as terminated
export async function deactivateEmployee(req, res) {
  if (String(req.user._id) === req.params.id) throw ApiError.badRequest('You cannot deactivate your own account');

  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.role === ROLES.ADMIN && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden();

  employee.status = 'terminated';
  employee.exitDate = req.body?.exitDate || new Date();
  await employee.save();
  disconnectUser(employee._id);
  sendSuccess(res, { message: 'Employee deactivated' });
}
