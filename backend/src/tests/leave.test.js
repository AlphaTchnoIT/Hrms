import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEntitlement } from '../services/leave.service.js';
import { buildHolidayLookup, holidayApplies } from '../services/calendar.service.js';

// UK holiday entitlement and regional bank holidays. Run: npm test
const annualLeave = { annualQuota: 25, proRata: true };

test('full-time, full year gets the full entitlement', () => {
  assert.equal(calculateEntitlement(annualLeave, { dateOfJoining: '2020-01-01', workingDaysPerWeek: 5 }, 2026), 25);
});

test('part-time is pro-rated on working days', () => {
  assert.equal(calculateEntitlement(annualLeave, { dateOfJoining: '2020-01-01', workingDaysPerWeek: 3 }, 2026), 15);
});

test('joiners and leavers get the part of the year they work, to the nearest half day', () => {
  // joined 1 July 2026: 184 of 365 days -> 12.6 -> 12.5
  assert.equal(calculateEntitlement(annualLeave, { dateOfJoining: '2026-07-01', workingDaysPerWeek: 5 }, 2026), 12.5);
  // left 31 March 2026: 90 of 365 days -> 6.16 -> 6
  assert.equal(calculateEntitlement(annualLeave, { dateOfJoining: '2020-01-01', exitDate: '2026-03-31', workingDaysPerWeek: 5 }, 2026), 6);
});

test('non pro-rata leave keeps the fixed quota', () => {
  assert.equal(calculateEntitlement({ annualQuota: 10, proRata: false }, { dateOfJoining: '2026-07-01', workingDaysPerWeek: 2 }, 2026), 10);
});

test('bank holidays by UK nation', () => {
  const holidays = [
    { date: '2026-04-06', name: 'Easter Monday', regions: ['england-wales', 'northern-ireland'] },
    { date: '2026-11-30', name: "St Andrew's Day", regions: ['scotland'] },
    { date: '2026-12-25', name: 'Christmas Day', regions: [] },
  ];
  const lookup = buildHolidayLookup(holidays);
  assert.equal(lookup('2026-04-06', 'england-wales'), 'Easter Monday');
  assert.equal(lookup('2026-04-06', 'scotland'), null);
  assert.equal(lookup('2026-11-30', 'scotland'), "St Andrew's Day");
  assert.equal(lookup('2026-12-25', 'northern-ireland'), 'Christmas Day');
  assert.equal(holidayApplies(holidays[0], undefined), true); // default region is England & Wales
});
