import { Holiday } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';

const FIELDS = ['name', 'date', 'type', 'description', 'regions'];

// GET /api/holidays?year=2026
export async function listHolidays(req, res) {
  const year = Number(req.query.year) || new Date().getFullYear();
  const holidays = await Holiday.find({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` } }).sort('date');
  sendSuccess(res, { data: holidays });
}

export async function createHoliday(req, res) {
  const holiday = await Holiday.create(pick(req.body, FIELDS));
  sendSuccess(res, { data: holiday, message: 'Holiday added', status: 201 });
}

export async function updateHoliday(req, res) {
  const holiday = await Holiday.findByIdAndUpdate(req.params.id, pick(req.body, FIELDS), { new: true, runValidators: true });
  if (!holiday) throw ApiError.notFound('Holiday not found');
  sendSuccess(res, { data: holiday, message: 'Holiday updated' });
}

export async function deleteHoliday(req, res) {
  const holiday = await Holiday.findByIdAndDelete(req.params.id);
  if (!holiday) throw ApiError.notFound('Holiday not found');
  sendSuccess(res, { message: 'Holiday deleted' });
}
