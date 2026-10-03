import { Announcement } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { pick } from '../utils/helpers.js';

const FIELDS = ['title', 'content', 'category', 'isPinned', 'expiresAt'];

// GET /api/announcements - active (not expired) announcements, pinned first
export async function listAnnouncements(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = req.query.includeExpired === 'true'
    ? {}
    : { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: new Date() } }] };

  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'firstName lastName avatar')
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(filter),
  ]);

  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
}

export async function createAnnouncement(req, res) {
  const body = pick(req.body, FIELDS);
  if (!body.expiresAt) body.expiresAt = null;

  const announcement = await Announcement.create({ ...body, createdBy: req.user._id });
  sendSuccess(res, { data: announcement, message: 'Announcement published', status: 201 });
}

export async function updateAnnouncement(req, res) {
  const body = pick(req.body, FIELDS);
  if (body.expiresAt === '') body.expiresAt = null;

  const announcement = await Announcement.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
  if (!announcement) throw ApiError.notFound('Announcement not found');
  sendSuccess(res, { data: announcement, message: 'Announcement updated' });
}

export async function deleteAnnouncement(req, res) {
  const announcement = await Announcement.findByIdAndDelete(req.params.id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  sendSuccess(res, { message: 'Announcement deleted' });
}
