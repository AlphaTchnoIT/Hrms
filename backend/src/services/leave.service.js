import { LeaveBalance, LeaveType } from '../models/index.js';

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
