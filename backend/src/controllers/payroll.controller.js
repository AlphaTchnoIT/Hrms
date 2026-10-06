import { PayrollRun, Payslip, Settings } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { isHR } from '../services/access.service.js';
import { runPayroll } from '../services/payroll.service.js';
import { notify } from '../services/notification.service.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// GET /api/payroll/runs  (HR)
export async function listRuns(_req, res) {
  const runs = await PayrollRun.find().populate('processedBy', 'firstName lastName').sort({ year: -1, month: -1 });
  sendSuccess(res, { data: runs });
}

// POST /api/payroll/runs  { month, year }  (HR)
export async function createRun(req, res) {
  const { month, year } = req.body;

  const now = new Date();
  if (year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)) {
    throw ApiError.field('month', 'Payroll cannot be run for a future month');
  }

  let run;
  try {
    run = await runPayroll({ month, year, processedBy: req.user._id });
  } catch (error) {
    throw ApiError.badRequest(error.message);
  }

  sendSuccess(res, { data: run, message: `Payroll processed for ${run.employeeCount} employee(s)`, status: 201 });
}

// GET /api/payroll/runs/:id  (HR) - run with all payslips
export async function getRun(req, res) {
  const run = await PayrollRun.findById(req.params.id).populate('processedBy', 'firstName lastName');
  if (!run) throw ApiError.notFound('Payroll run not found');

  const payslips = await Payslip.find({ payrollRun: run._id }).sort({ 'employeeSnapshot.name': 1 });
  sendSuccess(res, { data: { run, payslips } });
}

// PATCH /api/payroll/runs/:id/mark-paid  (HR) - locks the run
export async function markRunPaid(req, res) {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw ApiError.notFound('Payroll run not found');
  if (run.status === 'paid') throw ApiError.badRequest('Payroll is already marked as paid');

  run.status = 'paid';
  run.paidAt = new Date();
  await run.save();
  await Payslip.updateMany({ payrollRun: run._id }, { status: 'paid' });

  const payslips = await Payslip.find({ payrollRun: run._id }).select('user _id');
  payslips.forEach((p) =>
    notify(p.user, {
      title: 'Payslip available',
      message: `Your payslip for ${MONTH_NAMES[run.month - 1]} ${run.year} is now available`,
      link: `/payslips/${p._id}`,
    })
  );

  sendSuccess(res, { data: run, message: 'Payroll marked as paid' });
}

// DELETE /api/payroll/runs/:id  (HR) - only unpaid runs
export async function deleteRun(req, res) {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw ApiError.notFound('Payroll run not found');
  if (run.status === 'paid') throw ApiError.badRequest('A paid payroll cannot be deleted');

  await Payslip.deleteMany({ payrollRun: run._id });
  await run.deleteOne();
  sendSuccess(res, { message: 'Payroll run deleted' });
}

// GET /api/payroll/my-payslips - employees see only paid payslips
export async function getMyPayslips(req, res) {
  const payslips = await Payslip.find({ user: req.user._id, status: 'paid' })
    .select('month year netPay grossEarnings totalDeductions paidDays lopDays status')
    .sort({ year: -1, month: -1 });
  sendSuccess(res, { data: payslips });
}

// GET /api/payroll/payslips/:id - owner (if paid) or HR
export async function getPayslip(req, res) {
  const payslip = await Payslip.findById(req.params.id);
  if (!payslip) throw ApiError.notFound('Payslip not found');

  const isOwner = String(payslip.user) === String(req.user._id);
  if (!isHR(req.user) && !(isOwner && payslip.status === 'paid')) throw ApiError.forbidden();

  const settings = await Settings.getSettings();
  sendSuccess(res, {
    data: {
      payslip,
      company: {
        name: settings.companyName,
        address: settings.companyAddress,
        payeReference: settings.registrations?.payeReference,
        email: settings.companyEmail,
        currency: settings.currency,
      },
    },
  });
}
