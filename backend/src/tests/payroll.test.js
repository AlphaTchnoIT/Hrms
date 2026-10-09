import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_UK_PAYROLL } from '../constants/index.js';
import {
  applyManualItems,
  calculateIncomeTax,
  calculateNationalInsurance,
  calculatePayslip,
  calculatePension,
  calculateStudentLoans,
  isStatutoryItem,
  manualItemsOf,
  parseTaxCode,
} from '../services/payroll.service.js';

/*
 * UK payroll checks against hand-worked examples using the GOV.UK 2026/27 rates (monthly pay).
 * HMRC monthly thresholds: NI PT £1,048, UEL £4,189, ST £417; pension band £520-£4,189.
 * Run: npm test
 */
const rates = DEFAULT_UK_PAYROLL;
const settings = { payroll: rates };
const payslip = (salary, lopDays = 0) => calculatePayslip({ employee: { salary }, settings, totalDays: 30, lopDays });

test('tax codes', () => {
  assert.deepEqual(parseTaxCode('1257L', 12570), { scottish: false, allowance: 12570 });
  assert.deepEqual(parseTaxCode('S1257L', 12570), { scottish: true, allowance: 12570 });
  assert.deepEqual(parseTaxCode('C1257L M1', 12570), { scottish: false, allowance: 12570 });
  assert.deepEqual(parseTaxCode('K475', 12570), { scottish: false, allowance: -4750 });
  assert.deepEqual(parseTaxCode('0T', 12570), { scottish: false, allowance: 0 });
  assert.equal(parseTaxCode('NT', 12570).noTax, true);
});

test('£30,000 on 1257L with pension: tax, NI and pension', () => {
  // gross 2,500; pension 5% of (2,500 - 520) = 99; tax 20% of (2,401 x 12 - 12,570) / 12 = 270.70
  const p = payslip({ annualSalary: 30000, taxCode: '1257L', niCategory: 'A', pensionEnrolled: true });
  const amount = (name) => p.deductions.find((d) => d.name.startsWith(name))?.amount;
  assert.equal(p.grossEarnings, 2500);
  assert.equal(amount('Pension'), 99);
  assert.equal(amount('Income Tax'), 270.7);
  assert.equal(amount('National Insurance'), 116.16); // 8% of (2,500 - 1,048)
  assert.equal(p.netPay, 2014.14);
  assert.equal(p.employerContributions.find((c) => c.name.includes('National Insurance')).amount, 312.45); // 15% above 417
});

test('higher rate and the NI upper earnings limit', () => {
  // £60,000: taxable 4,816.54 / month after pension
  const tax = calculateIncomeTax(4816.54, '1257L', rates);
  assert.equal(tax, 879.28);
  const ni = calculateNationalInsurance(5000, 'A', rates);
  assert.equal(ni.employee, 267.5); // 8% of (4,189 - 1,048) + 2% of (5,000 - 4,189)
});

test('NI categories', () => {
  assert.equal(calculateNationalInsurance(3000, 'C', rates).employee, 0);
  assert.equal(calculateNationalInsurance(3000, 'X', rates).employer, 0);
  assert.equal(calculateNationalInsurance(3000, 'M', rates).employer, 0); // under 21, below the upper limit
  assert.equal(calculateNationalInsurance(3000, 'M', rates).employee, calculateNationalInsurance(3000, 'A', rates).employee);
});

test('special tax codes', () => {
  assert.equal(calculateIncomeTax(2500, 'BR', rates), 500);
  assert.equal(calculateIncomeTax(2500, 'NT', rates), 0);
  assert.ok(calculateIncomeTax(3750, 'S1257L', rates) > 0);
});

test('pension uses qualifying earnings only', () => {
  assert.deepEqual(calculatePension(400, rates), { employee: 0, employer: 0 }); // below the lower limit
  assert.equal(calculatePension(10000, rates).employee, 183.45); // 5% of (4,189 - 520), capped at the upper limit
});

test('student loans round down to whole pounds', () => {
  const items = calculateStudentLoans(3500, { studentLoanPlan: 'plan2', postgraduateLoan: true }, rates);
  assert.deepEqual(items, [
    { name: 'Student Loan (Plan 2)', amount: 94 }, // 9% of (3,500 - 2,448.75) = 94.61
    { name: 'Postgraduate Loan', amount: 105 }, // 6% of (3,500 - 1,750) = 105
  ]);
});

test('unpaid days reduce gross pay', () => {
  const full = payslip({ annualSalary: 36000 });
  const partial = payslip({ annualSalary: 36000 }, 3);
  assert.equal(full.grossEarnings, 3000);
  assert.equal(partial.grossEarnings, 2700);
  assert.equal(partial.paidDays, 27);
});

test('additional rate starts above £125,140 of taxable pay', () => {
  // 0T, £150,000 a year: 37,700 x 20% + 87,440 x 40% + 24,860 x 45% = 53,703 -> 4,475.25 a month
  assert.equal(calculateIncomeTax(12500, '0T', rates), 4475.25);
});

test('Scottish starter rate band ends at £3,967 above the allowance', () => {
  // £16,537 a year on S1257L: 3,967 x 19% = 753.73 -> 62.81 a month
  assert.equal(calculateIncomeTax(16537 / 12, 'S1257L', rates), 62.81);
});

test('2026/27 student loan thresholds', () => {
  assert.deepEqual(rates.studentLoanThresholds, { plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000, postgrad: 21000 });
});

test('hourly pay: rate x AT hours, overtime at the same rate', () => {
  // 5/hr x 25 hrs = 125, below every threshold so no tax / NI / pension
  const p = calculatePayslip({ employee: { salary: { payType: 'hourly', hourlyRate: 5 } }, settings, totalDays: 22, lopDays: 0, hoursWorked: 25 });
  assert.equal(p.grossEarnings, 125);
  assert.equal(p.earnings[0].name, 'Hourly Pay (25 hrs @ 5/hr)');
  assert.equal(p.hoursWorked, 25);
  assert.equal(p.netPay, 125);
  const big = calculatePayslip({ employee: { salary: { payType: 'hourly', hourlyRate: 20, taxCode: '1257L' } }, settings, totalDays: 22, lopDays: 0, hoursWorked: 200 });
  assert.equal(big.grossEarnings, 4000);
  assert.ok(big.deductions.some((d) => d.name.startsWith('Income Tax')));
});

test('manual deductions: no tax / NI / pension, net = gross', () => {
  const p = payslip({ annualSalary: 30000, deductionMode: 'manual' });
  assert.equal(p.grossEarnings, 2500);
  assert.deepEqual(p.deductions, []);
  assert.deepEqual(p.employerContributions, []);
  assert.equal(p.netPay, 2500);
  assert.equal(p.deductionMode, 'manual');
});

test('manual items, manual deductions: added to totals, replaced on edit', () => {
  const p = payslip({ annualSalary: 30000, deductionMode: 'manual' }); // gross 2,500, no deductions
  const salary = { annualSalary: 30000, deductionMode: 'manual' };
  applyManualItems(p, [
    { type: 'deduction', name: 'Income Tax', amount: 270.7 },
    { type: 'deduction', name: 'National Insurance', amount: 116.16 },
    { type: 'earning', name: 'Holiday pay', amount: 100 },
    { type: 'employer', name: 'Employer pension', amount: 59.4 },
  ], salary, rates);
  assert.equal(p.grossEarnings, 2600);
  assert.equal(p.taxablePay, 2600);
  assert.equal(p.totalDeductions, 386.86);
  assert.equal(p.netPay, 2213.14);
  assert.equal(manualItemsOf(p).length, 4);
  // Editing replaces the old manual items, the automatic ones stay
  applyManualItems(p, [{ type: 'deduction', name: 'Income Tax', amount: 200 }], salary, rates);
  assert.equal(p.grossEarnings, 2500);
  assert.equal(p.netPay, 2300);
  assert.deepEqual(p.employerContributions, []);
  assert.equal(p.earnings[0].name, 'Basic Pay');
});

test('manual earning with automatic deductions: tax and NI are worked out on the new gross', () => {
  const salary = { annualSalary: 30000, taxCode: '1257L', niCategory: 'A', pensionEnrolled: true };
  const withBonus = calculatePayslip({ employee: { salary }, settings, totalDays: 30, lopDays: 0, manualItems: [{ type: 'earning', name: 'Bonus', amount: 500 }] });
  const plain = calculatePayslip({ employee: { salary: { ...salary, annualSalary: 36000 } }, settings, totalDays: 30, lopDays: 0 }); // also 3,000 gross
  assert.equal(withBonus.grossEarnings, 3000);
  assert.deepEqual(withBonus.deductions, plain.deductions);
  assert.equal(withBonus.netPay, plain.netPay);
  // Removing the bonus brings the tax back down
  applyManualItems(withBonus, [], salary, rates);
  assert.equal(withBonus.netPay, payslip(salary).netPay);
});

test('statutory manual items are recognised (charged twice with automatic deductions)', () => {
  assert.equal(isStatutoryItem({ type: 'deduction', name: 'Income Tax' }), true);
  assert.equal(isStatutoryItem({ type: 'employer', name: 'Employer NI' }), true);
  assert.equal(isStatutoryItem({ type: 'deduction', name: 'Salary advance' }), false);
  assert.equal(isStatutoryItem({ type: 'earning', name: 'Pension refund' }), false);
});
