import {
  ActionPlan,
  Announcement,
  Attendance,
  Expense,
  Holiday,
  LeaveRequest,
  QaFeedback,
  Regularization,
  Settings,
  TrainingAssignment,
  User,
  Warning,
} from '../models/index.js';
import { sendSuccess } from '../utils/response.js';
import { addDays, todayInTz } from '../utils/date.js';
import { getBalancesForUser } from '../services/leave.service.js';
import { getPolicies, leaveYearOf } from '../services/policy.service.js';
import { getManagedUserFilter, isHR, isManager } from '../services/access.service.js';
import { getWorkforce } from '../services/workforce.service.js';
import { currentRange, getPerformanceSummaries } from '../services/performance.service.js';

// Birthdays & work anniversaries in the next `days` days
async function getUpcomingCelebrations(today, days = 30) {
  const employees = await User.find({ status: 'active' }).select('firstName lastName avatar dateOfBirth dateOfJoining').lean();
  const todayDate = new Date(`${today}T00:00:00Z`);
  const year = todayDate.getUTCFullYear();

  const daysUntil = (date) => {
    const d = new Date(date);
    let next = new Date(Date.UTC(year, d.getUTCMonth(), d.getUTCDate()));
    if (next < todayDate) next = new Date(Date.UTC(year + 1, d.getUTCMonth(), d.getUTCDate()));
    return { inDays: Math.round((next - todayDate) / 86400000), date: next.toISOString().slice(0, 10) };
  };

  const items = [];
  employees.forEach((e) => {
    const person = { _id: e._id, name: `${e.firstName} ${e.lastName || ''}`.trim(), avatar: e.avatar };
    if (e.dateOfBirth) {
      const { inDays, date } = daysUntil(e.dateOfBirth);
      if (inDays <= days) items.push({ ...person, type: 'birthday', date, inDays });
    }
    if (e.dateOfJoining) {
      const { inDays, date } = daysUntil(e.dateOfJoining);
      const years = Number(date.slice(0, 4)) - new Date(e.dateOfJoining).getUTCFullYear();
      if (inDays <= days && years > 0) items.push({ ...person, type: 'anniversary', date, inDays, years });
    }
  });

  return items.sort((a, b) => a.inDays - b.inDays).slice(0, 8);
}

// Count of employees with a check-in for each of the last 7 days
async function getAttendanceTrend(today, userFilter) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const match = { date: { $in: dates } };
  if (userFilter) match.user = userFilter;

  const counts = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: '$date', present: { $sum: 1 }, late: { $sum: { $cond: ['$isLate', 1, 0] } } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [c._id, c]));
  return dates.map((date) => ({ date, present: map[date]?.present || 0, late: map[date]?.late || 0 }));
}

/*
 * Widgets that are the same for everyone (holidays per region, announcements, birthdays, who is out)
 * are shared for a short time, so a busy morning doesn't run the same queries for every login.
 */
const SHARED_MS = 30 * 1000;
const shared = new Map(); // key -> { promise, at }
function sharedFor(key, load) {
  const hit = shared.get(key);
  if (hit && Date.now() - hit.at < SHARED_MS) return hit.promise;
  // A real Promise: a Mongoose query is only "thenable" and would run again on every .then / .catch
  const promise = Promise.resolve().then(load);
  shared.set(key, { promise, at: Date.now() });
  promise.catch(() => shared.delete(key)); // never keep a failed load
  return promise;
}
// New / edited / deleted announcements show up straight away
export const clearSharedDashboard = () => shared.clear();

// GET /api/dashboard
export async function getDashboard(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const user = req.user;
  const region = user.holidayRegion || 'england-wales';

  // "My workspace" doesn't depend on the cards below, so both sets of queries run at the same time
  const myWorkPromise = Promise.all([
    getWorkforce([user], today, addDays(today, 2), settings),
    getPerformanceSummaries([user], { ...currentRange(settings), settings }),
    QaFeedback.countDocuments({ user: user._id, acknowledgedAt: null }),
    Warning.countDocuments({ employee: user._id, status: 'issued' }),
    ActionPlan.countDocuments({ user: user._id, employeeAcknowledgedAt: null, status: { $in: ['open', 'in-progress'] } }),
    TrainingAssignment.countDocuments({ user: user._id, status: { $ne: 'completed' }, dueDate: { $lte: addDays(today, 7) } }),
  ]);
  myWorkPromise.catch(() => {}); // awaited below; avoids an unhandled rejection if the cards fail first

  const [todayAttendance, leaveBalances, upcomingHolidays, announcements, celebrations, whoIsOut, myPending] =
    await Promise.all([
      Attendance.findOne({ user: user._id, date: today }),
      getBalancesForUser(user._id, leaveYearOf(today, getPolicies(settings).leaveYearStartMonth)),
      sharedFor(`holidays:${today}:${region}`, () =>
        Holiday.find({ date: { $gte: today }, $or: [{ regions: { $size: 0 } }, { regions: region }] }).sort('date').limit(5).lean()
      ),
      sharedFor('announcements', () =>
        Announcement.find({ $or: [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }] })
          .populate('createdBy', 'firstName lastName')
          .sort({ isPinned: -1, createdAt: -1 })
          .limit(5)
          .lean()
      ),
      sharedFor(`celebrations:${today}`, () => getUpcomingCelebrations(today)),
      sharedFor(`whoIsOut:${today}`, () =>
        LeaveRequest.find({ status: 'approved', fromDate: { $lte: today }, toDate: { $gte: today } })
          .populate('user', 'firstName lastName avatar')
          .populate('leaveType', 'name color')
          .limit(10)
          .lean()
      ),
      Promise.all([
        LeaveRequest.countDocuments({ user: user._id, status: 'pending' }),
        Expense.countDocuments({ user: user._id, status: 'pending' }),
        Regularization.countDocuments({ user: user._id, status: 'pending' }),
      ]),
    ]);

  const data = {
    today,
    officeStartTime: settings.officeStartTime,
    officeEndTime: settings.officeEndTime,
    todayAttendance,
    leaveBalances,
    upcomingHolidays,
    announcements,
    celebrations,
    whoIsOut,
    myPending: { leaves: myPending[0], expenses: myPending[1], regularizations: myPending[2] },
  };

  // My workspace: next shifts, performance status and items waiting for me
  const [workforce, summaries, qaToAck, warningsToAck, plansToAck, trainingsDue] = await myWorkPromise;
  const mySummary = summaries[String(user._id)];
  data.myWork = {
    shifts: workforce[String(user._id)]?.days || [],
    performance: {
      status: mySummary.status,
      rating: mySummary.rating,
      compositeScore: mySummary.compositeScore,
      // The status is the worst metric (adherence included), so say which metrics set it
      below: Object.entries(mySummary.metrics)
        .filter(([, m]) => m.status && m.status !== 'meeting-target' && m.status === mySummary.status)
        .map(([metric, m]) => ({ metric, score: m.score, target: m.target })),
    },
    toAcknowledge: { qaFeedback: qaToAck, warnings: warningsToAck, actionPlans: plansToAck },
    trainingsDue,
  };


  // Team / company level stats for approvers
  if (isHR(user) || isManager(user)) {
    const userFilter = await getManagedUserFilter(user, { scope: 'all' });
    const employeeFilter = { status: 'active', ...(userFilter ? { _id: userFilter } : {}) };
    const requestFilter = { status: 'pending', ...(userFilter ? { user: userFilter } : {}) };
    const employeeIds = await User.find(employeeFilter).distinct('_id');
    const monthStart = `${today.slice(0, 7)}-01`;

    const [presentToday, lateToday, onLeaveToday, pendingLeaves, pendingRegularizations, pendingExpenses, newJoiners, trend] =
      await Promise.all([
        Attendance.countDocuments({ user: { $in: employeeIds }, date: today }),
        Attendance.countDocuments({ user: { $in: employeeIds }, date: today, isLate: true }),
        LeaveRequest.countDocuments({
          user: { $in: employeeIds },
          status: 'approved',
          fromDate: { $lte: today },
          toDate: { $gte: today },
        }),
        LeaveRequest.countDocuments(requestFilter),
        Regularization.countDocuments(requestFilter),
        Expense.countDocuments(requestFilter),
        User.countDocuments({ ...employeeFilter, dateOfJoining: { $gte: new Date(`${monthStart}T00:00:00Z`) } }),
        getAttendanceTrend(today, userFilter),
      ]);

    data.stats = {
      totalEmployees: employeeIds.length,
      presentToday,
      lateToday,
      onLeaveToday,
      absentToday: Math.max(0, employeeIds.length - presentToday - onLeaveToday),
      pendingLeaves,
      pendingRegularizations,
      pendingExpenses,
      newJoiners,
    };
    data.attendanceTrend = trend;

    if (isHR(user)) {
      data.departmentHeadcount = await User.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$department', count: { $sum: 1 } } },
        { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'department' } },
        { $project: { _id: 0, count: 1, name: { $ifNull: [{ $arrayElemAt: ['$department.name', 0] }, 'Unassigned'] } } },
        { $sort: { count: -1, name: 1 } }, // name breaks ties so the order is stable
      ]);
    }
  }

  sendSuccess(res, { data });
}
