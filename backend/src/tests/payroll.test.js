import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_UK_PAYROLL } from '../constants/index.js';
import {
  calculateIncomeTax,
  calculateNationalInsurance,
  calculatePayslip,
  calculatePension,
  calculateStudentLoans,
  parseTaxCode,
} from '../services/payroll.service.js';

/*
 * UK payroll checks against hand-worked examples (2026/27 default rates, monthly pay).
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
  assert.equal(amount('National Insurance'), 116.2); // 8% of (2,500 - 1,047.50)
  assert.equal(p.netPay, 2014.1);
  assert.equal(p.employerContributions.find((c) => c.name.includes('National Insurance')).amount, 312.5); // 15% above 416.67
});

test('higher rate and the NI upper earnings limit', () => {
  // £60,000: taxable 4,816.54 / month after pension
  const tax = calculateIncomeTax(4816.54, '1257L', rates);
  assert.equal(tax, 879.28);
  const ni = calculateNationalInsurance(5000, 'A', rates);
  assert.equal(ni.employee, 267.55); // 8% up to 4,189.17 then 2%
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
  assert.equal(calculatePension(10000, rates).employee, 183.46); // capped at the upper limit
});

test('student loans round down to whole pounds', () => {
  const items = calculateStudentLoans(3500, { studentLoanPlan: 'plan2', postgraduateLoan: true }, rates);
  assert.deepEqual(items, [
    { name: 'Student Loan (Plan 2)', amount: 101 }, // 9% of (3,500 - 2,372.50) = 101.47
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
