import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minutesOfDayInTz, todayInTz, zonedTimeToDate } from '../utils/date.js';

// Timezone helpers (formatters are cached per timezone, results must not depend on call order). Run: npm test

test('today in the company timezone', () => {
  const instant = new Date('2026-03-31T23:30:00Z');
  assert.equal(todayInTz('Europe/London', instant), '2026-04-01'); // BST, UTC+1
  assert.equal(todayInTz('Asia/Kolkata', instant), '2026-04-01'); // UTC+5:30
  assert.equal(todayInTz('America/New_York', instant), '2026-03-31');
  // same answers when zones are mixed and repeated (cache must be per zone)
  assert.equal(todayInTz('Europe/London', instant), '2026-04-01');
  assert.equal(todayInTz('America/New_York', instant), '2026-03-31');
});

test('minutes of the day across the UK clock change', () => {
  assert.equal(minutesOfDayInTz('Europe/London', new Date('2026-01-15T09:30:00Z')), 9 * 60 + 30); // GMT
  assert.equal(minutesOfDayInTz('Europe/London', new Date('2026-07-15T09:30:00Z')), 10 * 60 + 30); // BST
  assert.equal(minutesOfDayInTz('Asia/Kolkata', new Date('2026-07-15T09:30:00Z')), 15 * 60);
});

test('local office time -> real instant', () => {
  assert.equal(zonedTimeToDate('2026-01-15', '09:00', 'Europe/London').toISOString(), '2026-01-15T09:00:00.000Z');
  assert.equal(zonedTimeToDate('2026-07-15', '09:00', 'Europe/London').toISOString(), '2026-07-15T08:00:00.000Z');
  assert.equal(zonedTimeToDate('2026-07-15', '09:00', 'Asia/Kolkata').toISOString(), '2026-07-15T03:30:00.000Z');
});

test('an unknown timezone still fails loudly', () => {
  assert.throws(() => todayInTz('Mars/Olympus'), RangeError);
});
