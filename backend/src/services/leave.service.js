import { LeaveBalance, LeaveRequest, LeaveType, Settings, User } from '../models/index.js';
import { quarterOf } from '../utils/date.js';
import { getWorkingDates } from './calendar.service.js';
import { getPolicies, leaveYearRange } from './policy.service.js';

const roundHalf = (n) => Math.round(n * 2) / 2;

/*
 * Entitlement for a year. Pro-rata leave (UK annual leave) is scaled by
 * working days per week / 5 and by the part of the year the person is employed, rounded to half days.
 */
export function calculateEntitlement(leaveType, user, year, startMonth = 1) {
  const quota = leaveType?.annualQuota || 0;
  if (!leaveType?.proRata || !user) return quota;
  const range = leaveYearRange(year, startMonth);
  const yearStart = Date.parse(`${range.from}T00:00:00Z`);
  const yearEnd = Date.parse(`${range.to}T00:00:00Z`);
  const joined = user.dateOfJoining ? Math.max(new Date(user.dateOfJoining).getTime(), yearStart) : yearStart;
  const left = user.exitDate ? Math.min(new Date(user.exitDate).getTime(), yearEnd) : yearEnd;
  const daysInYear = (yearEnd - yearStart) / 86400000 + 1;
  const employedDays = Math.max(0, Math.floor((left - joined) / 86400000) + 1);
  const partTime = Math.min(1, (user.workingDaysPerWeek ?? 5) / 5);
  return roundHalf(quota * partTime * (employedDays / daysInYear));
}

// Unused days from last year that move into this year (up to the leave type's carry-over limit)
async function carriedForwardDays(userId, leaveType, year) {
  if (!leaveType?.carryForwardMax) return 0;
  const previous = await LeaveBalance.findOne({ user: userId, leaveType: leaveType._id, year: year - 1 });
  if (!previous) return 0;
  return Math.min(leaveType.carryForwardMax, Math.max(0, previous.allocated - previous.used - previous.pending));
}

// Returns the balance document for a user/leaveType/year, creating it with the year's entitlement if missing
export async function getOrCreateBalance(userId, leaveTypeId, year) {
  let balance = await LeaveBalance.findOne({ user: userId, leaveType: leaveTypeId, year });
  if (balance) return balance;

  const [leaveType, user, settings] = await Promise.all([
    LeaveType.findById(leaveTypeId),
    User.findById(userId).select('dateOfJoining exitDate workingDaysPerWeek'),
    Settings.getSettings(),
  ]);
  const carriedForward = await carriedForwardDays(userId, leaveType, year);
  try {
    balance = await LeaveBalance.create({
      user: userId,
      leaveType: leaveTypeId,
      year,
      allocated: calculateEntitlement(leaveType, user, year, getPolicies(settings).leaveYearStartMonth) + carriedForward,
      carriedForward,
    });
  } catch (error) {
    // Another request created it at the same moment
    if (error.code === 11000) return LeaveBalance.findOne({ user: userId, leaveType: leaveTypeId, year });
    throw error;
  }
  return balance;
}

// All active leave types with the user's balance for that year
export async function getBalancesForUser(userId, year) {
  const [leaveTypes, existing] = await Promise.all([
    LeaveType.find({ isActive: true }).sort('name'),
    LeaveBalance.find({ user: userId, year }), // one query for all types (was one per type)
  ]);
  const byType = new Map(existing.map((b) => [String(b.leaveType), b]));
  // Only a missing balance needs the slower create path
  const balances = await Promise.all(leaveTypes.map((type) => byType.get(String(type._id)) || getOrCreateBalance(userId, type._id, year)));

  return leaveTypes.map((type, index) => {
    const balance = balances[index];
    return {
      leaveType: type,
      allocated: balance.allocated,
      carriedForward: balance.carriedForward || 0,
      used: balance.used,
      pending: balance.pending,
      available: balance.allocated - balance.used - balance.pending,
    };
  });
}

// Move days between "pending" / "used" buckets
export async function adjustBalance(userId, leaveTypeId, year, { pending = 0, used = 0 }) {
  await getOrCreateBalance(userId, leaveTypeId, year);
  await LeaveBalance.updateOne({ user: userId, leaveType: leaveTypeId, year }, { $inc: { pending, used } });
}

/*
 * Approved leave days per leave type per quarter for a year.
 * Leaves that cross a quarter boundary are split by their working dates.
 * Returns { [userId]: { types: [{ leaveType, quarters: [q1, q2, q3, q4], total }], quarters, total } }
 */
export async function getQuarterlyLeaveSummary(userIds, year, settings) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [leaves, workingDates] = await Promise.all([
    LeaveRequest.find({ user: { $in: userIds }, status: 'approved', fromDate: { $lte: to }, toDate: { $gte: from } }).populate(
      'leaveType',
      'name code color isPaid'
    ),
    User.find({ _id: { $in: userIds } }).select('holidayRegion'),
  ]);
  // Bank holidays differ by UK nation, so working days are worked out per region
  const regionOf = Object.fromEntries(workingDates.map((u) => [String(u._id), u.holidayRegion]));
  const workingByRegion = {};
  for (const region of new Set(Object.values(regionOf))) workingByRegion[region] = new Set(await getWorkingDates(from, to, settings, region));

  const result = {};
  userIds.forEach((id) => (result[String(id)] = { typeMap: {}, quarters: [0, 0, 0, 0], total: 0 }));

  leaves.forEach((leave) => {
    const bucket = result[String(leave.user)];
    if (!bucket) return;
    const typeId = String(leave.leaveType?._id);
    bucket.typeMap[typeId] = bucket.typeMap[typeId] || { leaveType: leave.leaveType, quarters: [0, 0, 0, 0], total: 0 };
    const row = bucket.typeMap[typeId];

    const add = (date, value) => {
      const q = quarterOf(date) - 1;
      row.quarters[q] += value;
      row.total += value;
      bucket.quarters[q] += value;
      bucket.total += value;
    };

    if (leave.isHalfDay) {
      if (leave.fromDate.startsWith(String(year))) add(leave.fromDate, 0.5);
      return;
    }
    let date = leave.fromDate < from ? from : leave.fromDate;
    const end = leave.toDate > to ? to : leave.toDate;
    while (date <= end) {
      if (workingByRegion[regionOf[String(leave.user)]]?.has(date)) add(date, 1);
      const next = new Date(`${date}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      date = next.toISOString().slice(0, 10);
    }
  });

  Object.values(result).forEach((bucket) => {
    bucket.types = Object.values(bucket.typeMap).sort((a, b) => b.total - a.total);
    delete bucket.typeMap;
  });
  return result;
}
