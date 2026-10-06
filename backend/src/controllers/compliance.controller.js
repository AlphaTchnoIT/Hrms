import { ComplianceItem } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';
import { ensureDefaultChecklist } from '../services/compliance.service.js';

const FIELDS = ['category', 'title', 'description', 'status', 'owner', 'reviewedBy', 'reviewedOn', 'nextReviewOn', 'documentUrl', 'notes'];

// GET /api/compliance - the UK checklist with progress
export async function listCompliance(_req, res) {
  await ensureDefaultChecklist();
  const items = await ComplianceItem.find().populate('updatedBy', 'firstName lastName').sort({ order: 1, createdAt: 1 });
  const counted = items.filter((i) => i.status !== 'not-applicable');
  const done = counted.filter((i) => i.status === 'done').length;
  sendSuccess(res, { data: { items, progress: { done, total: counted.length, percent: counted.length ? Math.round((done / counted.length) * 100) : 100 } } });
}

// POST /api/compliance - a company-specific item
export async function createComplianceItem(req, res) {
  const item = await ComplianceItem.create({ ...pick(req.body, FIELDS), updatedBy: req.user._id, order: 1000 });
  sendSuccess(res, { data: item, message: 'Item added', status: 201 });
}

// PUT /api/compliance/:id
export async function updateComplianceItem(req, res) {
  const item = await ComplianceItem.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  const body = pick(req.body, FIELDS);
  // Built-in items keep their wording so the checklist stays complete
  if (item.key) {
    delete body.title;
    delete body.category;
    delete body.description;
  }
  item.set({ ...body, updatedBy: req.user._id });
  await item.save();
  sendSuccess(res, { data: item, message: 'Saved' });
}

// DELETE /api/compliance/:id - only company-specific items (built-in ones can be marked not applicable)
export async function deleteComplianceItem(req, res) {
  const item = await ComplianceItem.findById(req.params.id);
  if (!item) throw ApiError.notFound('Item not found');
  if (item.key) throw ApiError.badRequest('Built-in items cannot be deleted. Mark them "not applicable" instead.');
  await item.deleteOne();
  sendSuccess(res, { message: 'Item deleted' });
}
