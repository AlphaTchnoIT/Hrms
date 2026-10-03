import { User, generateCode } from '../models/index.js';
import { ROLES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { buildMeta, escapeRegex, getPagination } from '../utils/pagination.js';
import { emptyToNull, pick } from '../utils/helpers.js';
import { canManageEmployee, isHR } from '../services/access.service.js';

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
  'status',
  'exitDate',
  'panNumber',
  'bankDetails',
  'salary',
];

const REF_FIELDS = ['department', 'designation', 'reportingManager'];
const SENSITIVE_FIELDS = ['salary', 'bankDetails', 'panNumber'];

function buildEmployeeFilter(query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.department) filter.department = query.department;
  if (query.designation) filter.designation = query.designation;
  if (query.role) filter.role = query.role;
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

// GET /api/employees/directory  (everyone) - limited public info of active employees
export async function getDirectory(req, res) {
  const { page, limit, skip } = getPagination({ limit: 50, ...req.query });
  const filter = { ...buildEmployeeFilter(req.query), status: 'active' };

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

// GET /api/employees/team  (manager) - direct reports
export async function getMyTeam(req, res) {
  const team = await User.find({ reportingManager: req.user._id, status: 'active' })
    .select('-salary -bankDetails -panNumber')
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

  const password = req.body.password || 'Welcome@123';
  if (await User.exists({ email: body.email })) throw ApiError.field('email', 'An employee with this email already exists');

  const employeeCode = await generateCode('employee', 'EMP');
  const employee = await User.create({ ...body, password, employeeCode });

  const populated = await User.findById(employee._id).populate(USER_POPULATE);
  sendSuccess(res, { data: populated, message: `Employee ${employeeCode} created`, status: 201 });
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
  if (body.email && body.email !== employee.email && (await User.exists({ email: body.email }))) {
    throw ApiError.field('email', 'An employee with this email already exists');
  }

  // Merge nested objects so a partial update doesn't wipe other keys
  ['address', 'emergencyContact', 'bankDetails', 'salary'].forEach((key) => {
    if (body[key]) body[key] = { ...(employee[key]?.toObject?.() || {}), ...body[key] };
  });

  employee.set(body);
  await employee.save();

  const populated = await User.findById(employee._id).populate(USER_POPULATE);
  sendSuccess(res, { data: populated, message: 'Employee updated' });
}

// PATCH /api/employees/:id/reset-password  (HR)
export async function resetPassword(req, res) {
  const { newPassword } = req.body;

  const employee = await User.findById(req.params.id);
  if (!employee) throw ApiError.notFound('Employee not found');
  if (employee.role === ROLES.ADMIN && req.user.role !== ROLES.ADMIN) throw ApiError.forbidden();

  employee.password = newPassword;
  await employee.save();
  sendSuccess(res, { message: 'Password reset successfully' });
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
  sendSuccess(res, { message: 'Employee deactivated' });
}
