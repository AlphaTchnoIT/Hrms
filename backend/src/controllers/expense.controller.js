import { Expense, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { buildMeta, getPagination } from '../utils/pagination.js';
import { pick } from '../utils/helpers.js';
import { canManageEmployee, getManagedUserFilter } from '../services/access.service.js';
import { notify } from '../services/notification.service.js';

/*
 * HMRC approved mileage allowance (cars and vans): 45p a mile for the first 10,000 business miles
 * in the tax year (6 April - 5 April), 25p after that. Rates come from Settings -> UK payroll rates.
 */
async function mileageAmount(userId, miles, expenseDate) {
  const settings = await Settings.getSettings();
  const rates = { mileageRate: 0.45, mileageRateAfter10k: 0.25, ...(settings.payroll?.toObject?.() || {}) };
  const [y, m, d] = expenseDate.split('-').map(Number);
  const taxYearStart = m > 4 || (m === 4 && d >= 6) ? `${y}-04-06` : `${y - 1}-04-06`;
  const previous = await Expense.aggregate([
    { $match: { user: userId, category: 'mileage', status: { $ne: 'rejected' }, expenseDate: { $gte: taxYearStart, $lte: expenseDate } } },
    { $group: { _id: null, miles: { $sum: '$miles' } } },
  ]);
  const before = previous[0]?.miles || 0;
  const atFullRate = Math.max(0, Math.min(miles, 10000 - before));
  return Math.round((atFullRate * rates.mileageRate + (miles - atFullRate) * rates.mileageRateAfter10k) * 100) / 100;
}

// Amount in the company currency, e.g. "£45.00"
async function formatMoney(amount) {
  const { currency } = await Settings.getSettings();
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-GB', { style: 'currency', currency }).format(amount);
}

const FIELDS = ['title', 'category', 'amount', 'expenseDate', 'description', 'receiptUrl', 'miles'];
const EXPENSE_POPULATE = [
  { path: 'user', select: 'firstName lastName employeeCode avatar' },
  { path: 'reviewedBy', select: 'firstName lastName' },
];

// POST /api/expenses
export async function createExpense(req, res) {
  const body = pick(req.body, FIELDS);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  if (body.expenseDate < ninetyDaysAgo) throw ApiError.field('expenseDate', 'Claims must be submitted within 90 days of the expense');

  if (body.category === 'mileage') body.amount = await mileageAmount(req.user._id, body.miles, body.expenseDate);
  else delete body.miles;

  const expense = await Expense.create({ ...body, user: req.user._id });

  notify(req.user.reportingManager, {
    title: 'New expense claim',
    message: `${req.user.fullName} submitted an expense claim of ${await formatMoney(expense.amount)}`,
    link: '/team/expense-approvals',
  });

  sendSuccess(res, { data: expense, message: 'Expense claim submitted', status: 201 });
}

// GET /api/expenses/my
export async function getMyExpenses(req, res) {
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const expenses = await Expense.find(filter).populate(EXPENSE_POPULATE).sort({ createdAt: -1 }).limit(200);
  sendSuccess(res, { data: expenses });
}

// GET /api/expenses  (HR / manager)
export async function listExpenses(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;

  const managed = await getManagedUserFilter(req.user, { scope: req.query.scope });
  if (managed) filter.user = managed;

  const [items, total] = await Promise.all([
    Expense.find(filter).populate(EXPENSE_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Expense.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: buildMeta({ page, limit, total }) });
}

// PATCH /api/expenses/:id/review  { action: 'approve' | 'reject', note }
export async function reviewExpense(req, res) {
  const { action, note } = req.body;
  if (!['approve', 'reject'].includes(action)) throw ApiError.badRequest('Action must be approve or reject');

  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.status !== 'pending') throw ApiError.badRequest('This expense has already been reviewed');
  if (String(expense.user) === String(req.user._id)) throw ApiError.forbidden('You cannot review your own expense');
  if (!(await canManageEmployee(req.user, expense.user))) throw ApiError.forbidden();

  expense.status = action === 'approve' ? 'approved' : 'rejected';
  expense.reviewedBy = req.user._id;
  expense.reviewedAt = new Date();
  expense.reviewNote = note;
  await expense.save();

  notify(expense.user, {
    title: `Expense ${expense.status}`,
    message: `Your expense "${expense.title}" was ${expense.status}`,
    link: '/expenses',
  });

  sendSuccess(res, { data: expense, message: `Expense ${expense.status}` });
}

// PATCH /api/expenses/:id/reimburse  (HR)
export async function reimburseExpense(req, res) {
  const expense = await Expense.findById(req.params.id);
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.status !== 'approved') throw ApiError.badRequest('Only approved expenses can be reimbursed');

  expense.status = 'reimbursed';
  expense.reimbursedAt = new Date();
  await expense.save();

  notify(expense.user, {
    title: 'Expense reimbursed',
    message: `${await formatMoney(expense.amount)} for "${expense.title}" has been reimbursed`,
    link: '/expenses',
  });

  sendSuccess(res, { data: expense, message: 'Marked as reimbursed' });
}

// DELETE /api/expenses/:id - owner can delete a pending claim
export async function deleteExpense(req, res) {
  const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id });
  if (!expense) throw ApiError.notFound('Expense not found');
  if (expense.status !== 'pending') throw ApiError.badRequest('Only pending claims can be deleted');

  await expense.deleteOne();
  sendSuccess(res, { message: 'Expense deleted' });
}
