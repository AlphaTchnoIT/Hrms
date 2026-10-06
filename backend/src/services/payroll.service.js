import { PayrollRun, Payslip, Settings, User } from '../models/index.js';
import { daysInMonth, monthRange } from '../utils/date.js';
import { roundMoney } from '../utils/helpers.js';
import { buildMonthDays, calculateLopDays, loadMonthData } from './attendance.service.js';
import { DEFAULT_UK_PAYROLL } from '../constants/index.js';

/*
 * UK PAYE payroll, monthly.
 * Tax and NI use the "month 1" (non-cumulative) basis: this month's pay x 12, taxed on annual bands, / 12.
 * Pension uses a net pay arrangement (deducted before tax). Student loans are rounded down to whole pounds.
 * This gives correct payslips for regular monthly pay; filing to HMRC (RTI / FPS) is done in HMRC-recognised software.
 */

// "S1257L" -> { allowance: 12570, scottish: true }; "K475" -> negative allowance; BR / D0 / D1 / 0T / NT special codes
export function parseTaxCode(rawCode, personalAllowance) {
  const code = String(rawCode || '1257L').toUpperCase().replace(/\s/g, '').replace(/(W1|M1|X)$/, '');
  const scottish = code.startsWith('S');
  const body = code.replace(/^[SC]/, '');
  if (body === 'NT') return { scottish, noTax: true };
  if (body === 'BR') return { scottish, flatBand: 0 };
  if (body === 'D0') return { scottish, flatBand: 1 };
  if (body === 'D1') return { scottish, flatBand: 2 };
  if (body === '0T') return { scottish, allowance: 0 };
  const k = body.match(/^K(\d+)$/);
  if (k) return { scottish, allowance: -Number(k[1]) * 10 };
  const standard = body.match(/^(\d+)[LMNT]$/);
  if (standard) return { scottish, allowance: Number(standard[1]) * 10 };
  return { scottish, allowance: personalAllowance };
}

// Annual tax on `taxable` income (already after the allowance) using bands of { upTo (band width), rate }
function taxOnBands(taxable, bands) {
  let remaining = Math.max(0, taxable);
  let tax = 0;
  for (const band of bands) {
    if (remaining <= 0) break;
    const slice = band.upTo === null || band.upTo === undefined ? remaining : Math.min(remaining, band.upTo);
    tax += (slice * band.rate) / 100;
    remaining -= slice;
  }
  return tax;
}

export function calculateIncomeTax(monthlyTaxablePay, taxCode, rates) {
  const parsed = parseTaxCode(taxCode, rates.personalAllowance);
  if (parsed.noTax) return 0;
  const bands = parsed.scottish ? rates.scottishTaxBands : rates.taxBands;
  const annualPay = monthlyTaxablePay * 12;
  if (parsed.flatBand !== undefined) {
    // BR / D0 / D1: every pound taxed at one band's rate
    const band = bands[Math.min(parsed.flatBand + (parsed.scottish ? 1 : 0), bands.length - 1)];
    return roundMoney((annualPay * band.rate) / 100 / 12);
  }
  return roundMoney(taxOnBands(annualPay - parsed.allowance, bands) / 12);
}

// Employee and employer Class 1 National Insurance for one month
export function calculateNationalInsurance(monthlyPay, category, rates) {
  const pt = rates.niPrimaryThreshold / 12;
  const uel = rates.niUpperEarningsLimit / 12;
  const st = rates.niSecondaryThreshold / 12;
  let employee = 0;
  if (!['C', 'X'].includes(category)) {
    employee = (Math.max(0, Math.min(monthlyPay, uel) - pt) * rates.niMainRate) / 100 + (Math.max(0, monthlyPay - uel) * rates.niUpperRate) / 100;
  }
  let employer = 0;
  if (category !== 'X') {
    // Under 21 (M) and apprentices under 25 (H): no employer NI up to the upper limit
    const from = ['M', 'H'].includes(category) ? Math.max(st, uel) : st;
    employer = (Math.max(0, monthlyPay - from) * rates.niEmployerRate) / 100;
  }
  return { employee: roundMoney(employee), employer: roundMoney(employer) };
}

// Workplace pension on qualifying earnings (between the lower and upper limits)
export function calculatePension(monthlyPay, rates) {
  const qualifying = Math.max(0, Math.min(monthlyPay, rates.pensionUpperLimit / 12) - rates.pensionLowerLimit / 12);
  return {
    employee: roundMoney((qualifying * rates.pensionEmployeeRate) / 100),
    employer: roundMoney((qualifying * rates.pensionEmployerRate) / 100),
  };
}

// Student / postgraduate loan repayments (whole pounds, rounded down)
export function calculateStudentLoans(monthlyPay, { studentLoanPlan, postgraduateLoan }, rates) {
  const items = [];
  if (studentLoanPlan && studentLoanPlan !== 'none') {
    const threshold = rates.studentLoanThresholds[studentLoanPlan] / 12;
    const amount = Math.floor((Math.max(0, monthlyPay - threshold) * rates.studentLoanRate) / 100);
    if (amount > 0) items.push({ name: `Student Loan (${studentLoanPlan.replace('plan', 'Plan ')})`, amount });
  }
  if (postgraduateLoan) {
    const amount = Math.floor((Math.max(0, monthlyPay - rates.studentLoanThresholds.postgrad / 12) * rates.postgradLoanRate) / 100);
    if (amount > 0) items.push({ name: 'Postgraduate Loan', amount });
  }
  return items;
}

/*
 * One employee's payslip for the month.
 * Pay is prorated on calendar days for unpaid days: pay = monthly amount x (paid days / total days)
 */
export function calculatePayslip({ employee, settings, totalDays, lopDays }) {
  const salary = employee.salary || {};
  const rates = { ...DEFAULT_UK_PAYROLL, ...(settings.payroll?.toObject?.() || settings.payroll || {}) };
  const paidDays = Math.max(0, totalDays - lopDays);
  const ratio = totalDays ? paidDays / totalDays : 0;

  const earnings = [
    { name: 'Basic Pay', amount: roundMoney(((salary.annualSalary || 0) / 12) * ratio) },
    { name: 'Allowances', amount: roundMoney((salary.monthlyAllowance || 0) * ratio) },
  ].filter((item) => item.amount > 0);
  const grossEarnings = roundMoney(earnings.reduce((sum, item) => sum + item.amount, 0));

  const pension = salary.pensionEnrolled === false ? { employee: 0, employer: 0 } : calculatePension(grossEarnings, rates);
  const taxablePay = roundMoney(grossEarnings - pension.employee);
  const tax = calculateIncomeTax(taxablePay, salary.taxCode, rates);
  const ni = calculateNationalInsurance(grossEarnings, salary.niCategory || 'A', rates);

  const deductions = [
    { name: `Income Tax (PAYE, ${salary.taxCode || '1257L'})`, amount: tax },
    { name: `National Insurance (${salary.niCategory || 'A'})`, amount: ni.employee },
    { name: 'Pension (employee)', amount: pension.employee },
    ...calculateStudentLoans(grossEarnings, salary, rates),
  ].filter((item) => item.amount > 0);
  const employerContributions = [
    { name: 'Employer National Insurance', amount: ni.employer },
    { name: 'Employer pension', amount: pension.employer },
  ].filter((item) => item.amount > 0);

  const totalDeductions = roundMoney(deductions.reduce((sum, item) => sum + item.amount, 0));
  return {
    totalDays,
    paidDays,
    lopDays,
    earnings,
    deductions,
    employerContributions,
    grossEarnings,
    taxablePay,
    totalDeductions,
    netPay: roundMoney(Math.max(0, grossEarnings - totalDeductions)),
  };
}

/*
 * Runs payroll for a month: creates/updates one payslip per eligible employee.
 * Eligible = joined on or before month end AND (active, or exited during/after this month).
 */
export async function runPayroll({ month, year, processedBy }) {
  const existingRun = await PayrollRun.findOne({ month, year });
  if (existingRun?.status === 'paid') throw new Error('Payroll for this month is already marked as paid');

  const settings = await Settings.getSettings();
  const { start, end } = monthRange(year, month);
  const totalDays = daysInMonth(year, month);

  const employees = await User.find({
    dateOfJoining: { $lte: new Date(`${end}T23:59:59Z`) },
    $or: [{ status: 'active' }, { exitDate: { $gte: new Date(`${start}T00:00:00Z`) } }],
  }).populate('department', 'name').populate('designation', 'title');

  const monthData = await loadMonthData(employees.map((e) => e._id), year, month);

  const run = existingRun || new PayrollRun({ month, year });
  run.processedBy = processedBy;
  run.processedAt = new Date();
  run.status = 'processed';
  await run.save();

  // Re-running replaces old payslips of this month
  await Payslip.deleteMany({ payrollRun: run._id });

  const payslips = employees.map((employee) => {
    const { summary } = buildMonthDays({ user: employee, settings, ...monthData });
    // When attendance-based deduction is off, only unpaid leave and non-employed days are unpaid
    const lopDays = settings.attendanceBasedLop
      ? calculateLopDays(summary)
      : summary.unpaidLeave + summary.notEmployed;

    return {
      payrollRun: run._id,
      user: employee._id,
      month,
      year,
      employeeSnapshot: {
        name: employee.fullName,
        employeeCode: employee.employeeCode,
        department: employee.department?.name,
        designation: employee.designation?.title,
        dateOfJoining: employee.dateOfJoining,
        niNumber: employee.niNumber,
        taxCode: employee.salary?.taxCode,
        niCategory: employee.salary?.niCategory,
        bankName: employee.bankDetails?.bankName,
        sortCode: employee.bankDetails?.sortCode,
        accountNumber: employee.bankDetails?.accountNumber,
      },
      ...calculatePayslip({ employee, settings, totalDays, lopDays: Math.min(lopDays, totalDays) }),
    };
  });

  if (payslips.length) await Payslip.insertMany(payslips);

  run.employeeCount = payslips.length;
  run.totalGross = roundMoney(payslips.reduce((sum, p) => sum + p.grossEarnings, 0));
  run.totalDeductions = roundMoney(payslips.reduce((sum, p) => sum + p.totalDeductions, 0));
  run.totalNet = roundMoney(payslips.reduce((sum, p) => sum + p.netPay, 0));
  run.totalEmployerCost = roundMoney(payslips.reduce((sum, p) => sum + p.employerContributions.reduce((s2, c) => s2 + c.amount, 0), 0));
  await run.save();

  return run;
}
