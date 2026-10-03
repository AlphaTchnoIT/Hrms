import { LeaveBalance, LeaveRequest, LeaveType } from '../models/index.js';
import { quarterOf } from '../utils/date.js';
import { getWorkingDates } from './calendar.service.js';

// Returns the balance document for a user/leaveType/year, creating it with the yearly quota if missing
export async function getOrCreateBalance(userId, leaveTypeId, year) {
  let balance = await LeaveBalance.findOne({ user: userId, leaveType: leaveTypeId, year });
  if (balance) return balance;

  const leaveType = await LeaveType.findById(leaveTypeId);
  try {
    balance = await LeaveBalance.create({
      user: userId,
      leaveType: leaveTypeId,
      year,
      allocated: leaveType?.annualQuota || 0,
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
  const leaveTypes = await LeaveType.find({ isActive: true }).sort('name');
  const balances = await Promise.all(leaveTypes.map((type) => getOrCreateBalance(userId, type._id, year)));

  return leaveTypes.map((type, index) => {
    const balance = balances[index];
    return {
      leaveType: type,
      allocated: balance.allocated,
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
    getWorkingDates(from, to, settings),
  ]);
  const working = new Set(workingDates);

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
      if (working.has(date)) add(date, 1);
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
