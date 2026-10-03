import { Department, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { emptyToNull, pick } from '../utils/helpers.js';

const FIELDS = ['name', 'code', 'description', 'head', 'isActive'];

// GET /api/departments - includes active employee count per department
export async function listDepartments(_req, res) {
  const [departments, counts] = await Promise.all([
    Department.find().populate('head', 'firstName lastName employeeCode').sort('name'),
    User.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$department', count: { $sum: 1 } } }]),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  const data = departments.map((d) => ({ ...d.toJSON(), employeeCount: countMap[String(d._id)] || 0 }));

  sendSuccess(res, { data });
}

export async function createDepartment(req, res) {
  const department = await Department.create(emptyToNull(pick(req.body, FIELDS), ['head']));
  sendSuccess(res, { data: department, message: 'Department created', status: 201 });
}

export async function updateDepartment(req, res) {
  const department = await Department.findByIdAndUpdate(req.params.id, emptyToNull(pick(req.body, FIELDS), ['head']), {
    new: true,
    runValidators: true,
  });
  if (!department) throw ApiError.notFound('Department not found');
  sendSuccess(res, { data: department, message: 'Department updated' });
}

export async function deleteDepartment(req, res) {
  const inUse = await User.countDocuments({ department: req.params.id, status: 'active' });
  if (inUse) throw ApiError.badRequest(`Cannot delete: ${inUse} active employee(s) belong to this department`);

  const department = await Department.findByIdAndDelete(req.params.id);
  if (!department) throw ApiError.notFound('Department not found');
  sendSuccess(res, { message: 'Department deleted' });
}
