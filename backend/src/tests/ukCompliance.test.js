import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_UK_PAYROLL } from '../constants/index.js';
import {
  ageOn,
  autoEnrolmentStatus,
  bradfordFactor,
  calculateStatutoryPay,
  genderPayGap,
  minimumWageCheck,
  statutoryNoticeWeeks,
} from '../services/ukCompliance.service.js';

// UK employment rules with 2026/27 figures (GOV.UK). Run: npm test
const rates = DEFAULT_UK_PAYROLL;
const on = new Date('2026-10-06T12:00:00Z');

test('age', () => {
  assert.equal(ageOn('2005-10-07', on), 20);
  assert.equal(ageOn('2005-10-06', on), 21);
});

test('pension auto-enrolment categories', () => {
  assert.equal(autoEnrolmentStatus({ dateOfBirth: '1990-01-01', salary: { annualSalary: 30000 } }, rates, on), 'eligible');
  assert.equal(autoEnrolmentStatus({ dateOfBirth: '1990-01-01', salary: { annualSalary: 9000 } }, rates, on), 'non-eligible'); // under £10,000 trigger
  assert.equal(autoEnrolmentStatus({ dateOfBirth: '2006-01-01', salary: { annualSalary: 30000 } }, rates, on), 'non-eligible'); // aged 20
  assert.equal(autoEnrolmentStatus({ dateOfBirth: '1990-01-01', salary: { annualSalary: 5000 } }, rates, on), 'entitled'); // under £6,240
});

test('minimum wage on contracted hours', () => {
  // £24,000 / 52 / 37.5 = £12.31 < £12.71 for 21+
  const low = minimumWageCheck({ dateOfBirth: '1995-01-01', contractedHoursPerWeek: 37.5, salary: { annualSalary: 24000 } }, rates, on);
  assert.deepEqual({ hourly: low.hourly, required: low.required, ok: low.ok }, { hourly: 12.31, required: 12.71, ok: false });
  // same pay at 19 years old: 18-20 rate £10.85
  assert.equal(minimumWageCheck({ dateOfBirth: '2007-01-01', contractedHoursPerWeek: 37.5, salary: { annualSalary: 24000 } }, rates, on).ok, true);
  // apprentice in first year: £8
  const apprentice = minimumWageCheck({ dateOfBirth: '1995-01-01', employmentType: 'apprentice', dateOfJoining: '2026-06-01', contractedHoursPerWeek: 37.5, salary: { annualSalary: 16000 } }, rates, on);
  assert.equal(apprentice.band, 'apprentice');
  assert.equal(apprentice.ok, true);
});

test('statutory notice: 1 week per full year, 1 to 12 weeks', () => {
  assert.equal(statutoryNoticeWeeks('2026-09-20', on), 0);
  assert.equal(statutoryNoticeWeeks('2026-06-01', on), 1);
  assert.equal(statutoryNoticeWeeks('2021-06-01', on), 5);
  assert.equal(statutoryNoticeWeeks('2000-01-01', on), 12);
});

test('SSP: lower of £123.25 or 80% of weekly earnings, per working day', () => {
  // £30,000: AWE 576.92 -> £123.25 a week -> 3 days on a 5-day week = 73.95
  assert.deepEqual(calculateStatutoryPay({ salary: { annualSalary: 30000 }, sickDays: 3, monthStart: '2026-10-01', monthEnd: '2026-10-31', rates }), [
    { name: 'Statutory Sick Pay (SSP)', amount: 73.95 },
  ]);
  // £5,200 a year: AWE 100 -> 80% = £80 a week -> 5 days = 80
  assert.equal(calculateStatutoryPay({ salary: { annualSalary: 5200 }, sickDays: 5, monthStart: '2026-10-01', monthEnd: '2026-10-31', rates })[0].amount, 80);
});

test('SMP: 90% for 6 weeks, then the lower of £194.32 or 90%', () => {
  // AWE 1,000 (£52,000): first 7 days of leave in the month = 900 a week
  const leave = { fromDate: '2026-10-01', toDate: '2027-06-30', leaveType: { statutoryPay: 'smp' } };
  const first = calculateStatutoryPay({ salary: { annualSalary: 52000 }, leaves: [leave], monthStart: '2026-10-01', monthEnd: '2026-10-07', rates });
  assert.deepEqual(first, [{ name: 'Statutory Maternity Pay (SMP)', amount: 900 }]);
  // week 7 onwards: flat £194.32 a week
  const later = calculateStatutoryPay({ salary: { annualSalary: 52000 }, leaves: [leave], monthStart: '2026-11-12', monthEnd: '2026-11-18', rates });
  assert.equal(later[0].amount, 194.32);
});

test('SPP: two weeks at the flat rate', () => {
  const leave = { fromDate: '2026-10-05', toDate: '2026-10-25', leaveType: { statutoryPay: 'spp' } };
  const pay = calculateStatutoryPay({ salary: { annualSalary: 40000 }, leaves: [leave], monthStart: '2026-10-01', monthEnd: '2026-10-31', rates });
  assert.deepEqual(pay, [{ name: 'Statutory Paternity Pay (SPP)', amount: 388.64 }]);
});

test('Bradford Factor', () => {
  assert.equal(bradfordFactor(1, 10), 10);
  assert.equal(bradfordFactor(10, 10), 1000);
});

test('gender pay gap', () => {
  const result = genderPayGap([
    { gender: 'male', hourly: 20 },
    { gender: 'male', hourly: 30 },
    { gender: 'female', hourly: 18 },
    { gender: 'female', hourly: 22 },
  ]);
  assert.equal(result.meanGap, 20); // men 25, women 20
  assert.equal(result.medianGap, 20);
  assert.equal(result.quartiles.length, 4);
});

test('leave year: January-December or April-March', async () => {
  const { leaveYearOf, leaveYearRange } = await import('../services/policy.service.js');
  assert.equal(leaveYearOf('2026-03-10', 1), 2026);
  assert.equal(leaveYearOf('2026-03-10', 4), 2025);
  assert.equal(leaveYearOf('2026-04-01', 4), 2026);
  assert.deepEqual(leaveYearRange(2026, 1), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(leaveYearRange(2026, 4), { from: '2026-04-01', to: '2027-03-31' });
});

test('enhanced maternity pay tops SMP up to the company %', () => {
  // £36,500 a year = £100 a day; AWE 701.92 -> 90% = 631.73 a week. Company: 4 weeks at 100%
  const leave = { fromDate: '2026-10-01', toDate: '2027-06-30', leaveType: { statutoryPay: 'smp' } };
  const pay = calculateStatutoryPay({ salary: { annualSalary: 36500 }, leaves: [leave], monthStart: '2026-10-01', monthEnd: '2026-10-07', rates, policies: { enhancedMaternityWeeks: 4, enhancedMaternityPercent: 100 } });
  const total = pay.reduce((s, p) => s + p.amount, 0);
  assert.equal(Math.round(total), 700); // 7 days at full normal pay
});

test('SSP stops after 28 weeks of a spell', async () => {
  const { sspPayableDays } = await import('../services/ukCompliance.service.js');
  const spell = { fromDate: '2026-01-01', isHalfDay: false, leaveType: { statutoryPay: 'ssp' } };
  const days = [
    { date: '2026-07-14', status: 'leave', leave: spell }, // day 194: within 28 weeks (196 days)
    { date: '2026-07-16', status: 'leave', leave: spell }, // day 196: past the limit
  ];
  assert.equal(sspPayableDays(days, 28), 1);
});
