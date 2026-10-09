import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adherentMinutes } from '../services/workforce.service.js';

// Shift 09:00-17:00 (480 minutes) in London on a BST date (UTC+1)
const shift = { startTime: '09:00', endTime: '17:00' };
const base = { date: '2026-07-01', shift, scheduledMinutes: 480, timeZone: 'Europe/London', now: new Date('2026-07-10T12:00:00Z') };
const punch = (inUtc, outUtc) => ({ checkIn: { time: new Date(inUtc) }, checkOut: outUtc ? { time: new Date(outUtc) } : undefined });

test('schedule adherence: only minutes inside the shift count', () => {
  assert.equal(adherentMinutes({ ...base, record: punch('2026-07-01T08:00:00Z', '2026-07-01T16:00:00Z') }), 480); // 09:00-17:00 local
  assert.equal(adherentMinutes({ ...base, record: punch('2026-07-01T08:30:00Z', '2026-07-01T16:30:00Z') }), 450); // 30 min late, stayed late
  assert.equal(adherentMinutes({ ...base, record: punch('2026-07-01T07:00:00Z', '2026-07-01T12:00:00Z') }), 240); // left at 13:00
  assert.equal(adherentMinutes({ ...base, record: punch('2026-07-01T08:00:00Z') }), 0); // past day, no check-out
  assert.equal(adherentMinutes({ ...base, record: null }), 0);
  // Night shift 22:00-06:00 still in progress the next morning: counts up to now
  const night = { date: '2026-07-01', shift: { startTime: '22:00', endTime: '06:00' }, scheduledMinutes: 480, timeZone: 'Europe/London', today: '2026-07-02', now: new Date('2026-07-02T01:00:00Z') };
  assert.equal(adherentMinutes({ ...night, record: punch('2026-07-01T21:00:00Z') }), 240); // 22:00 -> 02:00 local
  assert.equal(adherentMinutes({ ...base, scheduledMinutes: 0, record: punch('2026-07-01T08:00:00Z', '2026-07-01T16:00:00Z') }), 0); // weekly off
});
