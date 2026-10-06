import { Holiday } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';
import { syncUkBankHolidays } from '../services/bankHolidays.service.js';

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

// POST /api/holidays/sync-uk { year } - load the official UK bank holidays for a year from GOV.UK (HR)
export async function syncHolidaysFromGovUk(req, res) {
  const year = Number(req.body?.year) || new Date().getFullYear();
  let result;
  try {
    result = await syncUkBankHolidays({ from: `${year}-01-01`, to: `${year}-12-31` });
  } catch (error) {
    throw ApiError.badRequest(`Could not reach GOV.UK (${error.message}). Please try again or add the holidays by hand.`);
  }
  if (!result.total) throw ApiError.badRequest(`GOV.UK has not published bank holidays for ${year} yet`);
  sendSuccess(res, { data: result, message: `${year}: ${result.added} added, ${result.updated} updated, ${result.removed} removed from the official GOV.UK list` });
}
