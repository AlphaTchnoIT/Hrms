import { PayrollRun, Payslip, Settings, User } from '../models/index.js';
import { monthRange } from '../utils/date.js';
import { roundMoney } from '../utils/helpers.js';
import { buildMonthDays, loadMonthData } from './attendance.service.js';
import { DEFAULT_UK_PAYROLL } from '../constants/index.js';
import { autoEnrolmentStatus, calculateStatutoryPay, minimumWageCheck, sspPayableDays } from './ukCompliance.service.js';
import { getPolicies } from './policy.service.js';

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

// Annual threshold -> monthly, rounded to the pound as HMRC and the Pensions Regulator publish them
const monthly = (annual) => Math.round(annual / 12);

// Employee and employer Class 1 National Insurance for one month
export function calculateNationalInsurance(monthlyPay, category, rates) {
  const pt = monthly(rates.niPrimaryThreshold);
  const uel = monthly(rates.niUpperEarningsLimit);
  const st = monthly(rates.niSecondaryThreshold);
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
  const qualifying = Math.max(0, Math.min(monthlyPay, monthly(rates.pensionUpperLimit)) - monthly(rates.pensionLowerLimit));
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
 * Pay is prorated on working days: pay = monthly amount x (paid working days / working days)
 */
export function payrollRates(settings) {
  return { ...DEFAULT_UK_PAYROLL, ...(settings.payroll?.toObject?.() || settings.payroll || {}) };
}

export function calculatePayslip({ employee, settings, totalDays, lopDays, statutoryPay = [] }) {
  const salary = employee.salary || {};
  const rates = payrollRates(settings);
  const paidDays = Math.max(0, totalDays - lopDays);
  const ratio = totalDays ? paidDays / totalDays : 0;

  const earnings = [
    { name: 'Basic Pay', amount: roundMoney(((salary.annualSalary || 0) / 12) * ratio) },
    { name: 'Allowances', amount: roundMoney((salary.monthlyAllowance || 0) * ratio) },
    ...statutoryPay, // SSP / SMP / SPP are taxable pay and count for NI
  ].filter((item) => item.amount > 0);
  const grossEarnings = roundMoney(earnings.reduce((sum, item) => sum + item.amount, 0));

  const inPension = salary.pensionEnrolled !== false && !salary.pensionOptedOutOn;
  const pension = inPension ? calculatePension(grossEarnings, rates) : { employee: 0, employer: 0 };
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

  const rates = payrollRates(settings);
  const warnings = [];
  const payslips = employees.map((employee) => {
    const { days, summary } = buildMonthDays({ user: employee, settings, ...monthData });
    // Statutory pay replaces salary on SSP / SMP / SPP leave (that leave is unpaid by the company)
    const statutoryPay = calculateStatutoryPay({
      salary: employee.salary,
      workingDaysPerWeek: employee.workingDaysPerWeek,
      leaves: monthData.leaves.filter((l) => String(l.user) === String(employee._id)),
      sspSickDays: sspPayableDays(days, rates.sspMaxWeeks),
      policies: getPolicies(settings),
      monthStart: start,
      monthEnd: end,
      rates,
    });

    if (employee.status === 'active') {
      const wage = minimumWageCheck(employee, rates);
      if (wage && !wage.ok) warnings.push({ user: employee._id, name: employee.fullName, message: `Below minimum wage: £${wage.hourly}/hour on ${employee.contractedHoursPerWeek} contracted hours (needs £${wage.required})` });
      const pensionStatus = autoEnrolmentStatus(employee, rates);
      if (pensionStatus === 'eligible' && employee.salary?.pensionEnrolled === false && !employee.salary?.pensionOptedOutOn) {
        warnings.push({ user: employee._id, name: employee.fullName, message: 'Eligible for workplace pension auto-enrolment but not enrolled (no opt-out recorded)' });
      }
    }
    /*
     * Working-day basis (UK practice for monthly salaries): unpaid = unauthorised absence (when that rule is on)
     * + unpaid / statutory-pay leave + working days before joining or after leaving.
     * Part-timers without a roster: the company's working days scaled by their days per week.
     */
    const hasRoster = monthData.rosters.some((r) => String(r.user) === String(employee._id));
    const factor = hasRoster ? 1 : Math.min(1, (employee.workingDaysPerWeek ?? 5) / 5);
    const workingDays = days.filter((d) => d.scheduled).length * factor;
    const notEmployedWorking = days.filter((d) => d.status === 'not-employed' && d.scheduled).length * factor;
    const absence = settings.attendanceBasedLop ? summary.absent + summary.halfDay * 0.5 : 0;
    const lopDays = Math.round((absence + summary.unpaidLeave + notEmployedWorking) * 10) / 10;

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
      ...calculatePayslip({ employee, settings, totalDays: Math.round(workingDays * 10) / 10, lopDays: Math.min(lopDays, workingDays), statutoryPay }),
    };
  });

  if (payslips.length) await Payslip.insertMany(payslips);

  run.employeeCount = payslips.length;
  run.totalGross = roundMoney(payslips.reduce((sum, p) => sum + p.grossEarnings, 0));
  run.totalDeductions = roundMoney(payslips.reduce((sum, p) => sum + p.totalDeductions, 0));
  run.totalNet = roundMoney(payslips.reduce((sum, p) => sum + p.netPay, 0));
  run.warnings = warnings;
  run.totalEmployerCost = roundMoney(payslips.reduce((sum, p) => sum + p.employerContributions.reduce((s2, c) => s2 + c.amount, 0), 0));
  await run.save();

  return run;
}
