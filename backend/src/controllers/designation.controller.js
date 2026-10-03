import { Designation, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';

const FIELDS = ['title', 'level', 'description', 'isActive'];

export async function listDesignations(_req, res) {
  const [designations, counts] = await Promise.all([
    Designation.find().sort({ level: 1, title: 1 }),
    User.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$designation', count: { $sum: 1 } } }]),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
  const data = designations.map((d) => ({ ...d.toJSON(), employeeCount: countMap[String(d._id)] || 0 }));

  sendSuccess(res, { data });
}

export async function createDesignation(req, res) {
  const designation = await Designation.create(pick(req.body, FIELDS));
  sendSuccess(res, { data: designation, message: 'Designation created', status: 201 });
}

export async function updateDesignation(req, res) {
  const designation = await Designation.findByIdAndUpdate(req.params.id, pick(req.body, FIELDS), {
    new: true,
    runValidators: true,
  });
  if (!designation) throw ApiError.notFound('Designation not found');
  sendSuccess(res, { data: designation, message: 'Designation updated' });
}

export async function deleteDesignation(req, res) {
  const inUse = await User.countDocuments({ designation: req.params.id, status: 'active' });
  if (inUse) throw ApiError.badRequest(`Cannot delete: ${inUse} active employee(s) have this designation`);

  const designation = await Designation.findByIdAndDelete(req.params.id);
  if (!designation) throw ApiError.notFound('Designation not found');
  sendSuccess(res, { message: 'Designation deleted' });
}
