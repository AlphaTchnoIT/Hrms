import { Asset, User, generateCode } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { buildMeta, escapeRegex, getPagination } from '../utils/pagination.js';
import { pick } from '../utils/helpers.js';
import { notify } from '../services/notification.service.js';

const FIELDS = ['name', 'category', 'brand', 'serialNumber', 'purchaseDate', 'purchaseCost', 'status', 'notes'];
const ASSIGNEE = { path: 'assignedTo', select: 'firstName lastName employeeCode avatar' };

// GET /api/assets  (HR)
export async function listAssets(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    filter.$or = [{ name: regex }, { assetTag: regex }, { serialNumber: regex }, { brand: regex }];
  }

  const [items, total] = await Promise.all([
    Asset.find(filter).populate(ASSIGNEE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Asset.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
}

// GET /api/assets/my
export async function getMyAssets(req, res) {
  sendSuccess(res, { data: await Asset.find({ assignedTo: req.user._id }).sort('name') });
}

export async function createAsset(req, res) {
  const body = pick(req.body, FIELDS);
  delete body.status; // new assets always start as available
  const asset = await Asset.create({ ...body, assetTag: await generateCode('asset', 'AST') });
  sendSuccess(res, { data: asset, message: 'Asset added', status: 201 });
}

export async function updateAsset(req, res) {
  const body = pick(req.body, FIELDS);
  const asset = await Asset.findById(req.params.id);
  if (!asset) throw ApiError.notFound('Asset not found');

  // Status "assigned" is controlled only through assign / return
  if (body.status === 'assigned' && !asset.assignedTo) delete body.status;
  if (body.status && body.status !== 'assigned' && asset.assignedTo) {
    throw ApiError.badRequest('Return the asset before changing its status');
  }

  asset.set(body);
  await asset.save();
  sendSuccess(res, { data: await asset.populate(ASSIGNEE), message: 'Asset updated' });
}

// PATCH /api/assets/:id/assign  { userId, assignedDate }
export async function assignAsset(req, res) {
  const asset = await Asset.findById(req.params.id);
  if (!asset) throw ApiError.notFound('Asset not found');
  if (asset.status !== 'available') throw ApiError.badRequest('Only available assets can be assigned');

  const employee = await User.findOne({ _id: req.body.userId, status: 'active' });
  if (!employee) throw ApiError.badRequest('Please select an active employee');

  asset.assignedTo = employee._id;
  asset.assignedDate = req.body.assignedDate || new Date().toISOString().slice(0, 10);
  asset.status = 'assigned';
  await asset.save();

  notify(employee._id, { title: 'Asset assigned', message: `${asset.name} (${asset.assetTag}) was assigned to you`, link: '/profile' });
  sendSuccess(res, { data: await asset.populate(ASSIGNEE), message: `Assigned to ${employee.fullName}` });
}

// PATCH /api/assets/:id/return
export async function returnAsset(req, res) {
  const asset = await Asset.findById(req.params.id);
  if (!asset) throw ApiError.notFound('Asset not found');
  if (!asset.assignedTo) throw ApiError.badRequest('This asset is not assigned to anyone');

  asset.assignedTo = null;
  asset.assignedDate = null;
  asset.status = 'available';
  await asset.save();
  sendSuccess(res, { data: asset, message: 'Asset returned' });
}

export async function deleteAsset(req, res) {
  const asset = await Asset.findById(req.params.id);
  if (!asset) throw ApiError.notFound('Asset not found');
  if (asset.assignedTo) throw ApiError.badRequest('Return the asset before deleting it');

  await asset.deleteOne();
  sendSuccess(res, { message: 'Asset deleted' });
}
