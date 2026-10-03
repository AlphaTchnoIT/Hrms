import { PayrollRun, Payslip, Settings, User } from '../models/index.js';
import { daysInMonth, monthRange } from '../utils/date.js';
import { roundMoney } from '../utils/helpers.js';
import { buildMonthDays, calculateLopDays, loadMonthData } from './attendance.service.js';

const EARNING_COMPONENTS = [
  ['basic', 'Basic Salary'],
  ['hra', 'House Rent Allowance'],
  ['conveyance', 'Conveyance Allowance'],
  ['specialAllowance', 'Special Allowance'],
  ['otherAllowance', 'Other Allowance'],
];

/*
 * Calculates one employee's payslip numbers for the month.
 * Salary is prorated on calendar days: pay = monthly amount x (paid days / total days)
 */
export function calculatePayslip({ employee, settings, totalDays, lopDays }) {
  const salary = employee.salary || {};
  const paidDays = Math.max(0, totalDays - lopDays);
  const ratio = totalDays ? paidDays / totalDays : 0;

  const earnings = EARNING_COMPONENTS.map(([key, name]) => ({ name, amount: roundMoney((salary[key] || 0) * ratio) }))
    .filter((item) => item.amount > 0);
  const grossEarnings = roundMoney(earnings.reduce((sum, item) => sum + item.amount, 0));

  const deductions = [];
  if (salary.pfApplicable) {
    const basicEarned = earnings.find((e) => e.name === 'Basic Salary')?.amount || 0;
    let pf = roundMoney((basicEarned * settings.pfRate) / 100);
    if (settings.pfCeiling > 0) pf = Math.min(pf, settings.pfCeiling);
    if (pf > 0) deductions.push({ name: 'Provident Fund (Employee)', amount: pf });
  }
  if (settings.professionalTax > 0 && grossEarnings > 0) {
    deductions.push({ name: 'Professional Tax', amount: settings.professionalTax });
  }
  if (salary.monthlyTds > 0 && grossEarnings > 0) {
    deductions.push({ name: 'Income Tax (TDS)', amount: roundMoney(salary.monthlyTds) });
  }

  const totalDeductions = roundMoney(deductions.reduce((sum, item) => sum + item.amount, 0));
  return {
    totalDays,
    paidDays,
    lopDays,
    earnings,
    deductions,
    grossEarnings,
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
    // When attendance-based LOP is off, only unpaid leave and non-employed days are deducted
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
        panNumber: employee.panNumber,
        bankName: employee.bankDetails?.bankName,
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
  await run.save();

  return run;
}
