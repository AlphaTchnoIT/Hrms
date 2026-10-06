import {
  ActionPlan,
  Asset,
  Attendance,
  Escalation,
  Expense,
  Goal,
  Grievance,
  KpiRecord,
  LeaveBalance,
  LeaveRequest,
  Notification,
  Payslip,
  QaFeedback,
  RatingReview,
  Regularization,
  Roster,
  Suggestion,
  TestAttempt,
  Ticket,
  TrainingAssignment,
  User,
  Warning,
  WorkStatusLog,
} from '../models/index.js';
import { addDays, toDateStr } from '../utils/date.js';

/*
 * UK GDPR helpers.
 * - buildPersonalDataExport: everything the app holds about one person (subject access request)
 * - anonymiseEmployee: removes personal details of a leaver after the retention period,
 *   keeping anonymous records (attendance, leave, payroll totals) for reporting
 */

const plain = (docs) => docs.map((d) => (d.toObject ? d.toObject() : d));

export async function buildPersonalDataExport(userId) {
  const user = await User.findById(userId)
    .populate('department', 'name')
    .populate('designation', 'title')
    .populate('reportingManager', 'firstName lastName email');
  if (!user) return null;

  const byUser = { user: userId };
  const [attendance, leaveRequests, leaveBalances, regularizations, payslips, expenses, goals, kpis, qaFeedback, ratings, actionPlans, warnings, escalations, training, testAttempts, rosters, workStatus, tickets, grievances, suggestions, assets, notifications] =
    await Promise.all([
      Attendance.find(byUser).sort('date'),
      LeaveRequest.find(byUser).populate('leaveType', 'name code').sort('fromDate'),
      LeaveBalance.find(byUser).populate('leaveType', 'name code').sort('year'),
      Regularization.find(byUser).sort('date'),
      Payslip.find({ ...byUser, status: 'paid' }).sort({ year: 1, month: 1 }),
      Expense.find(byUser).sort('expenseDate'),
      Goal.find(byUser),
      KpiRecord.find(byUser).sort('date'),
      QaFeedback.find(byUser).sort('auditDate'),
      RatingReview.find(byUser).sort('period'),
      ActionPlan.find(byUser),
      Warning.find({ employee: userId }),
      Escalation.find({ employee: userId }),
      TrainingAssignment.find(byUser).populate('program', 'title'),
      TestAttempt.find(byUser).populate('test', 'title'),
      Roster.find(byUser).sort('date'),
      WorkStatusLog.find(byUser).sort('startedAt'),
      Ticket.find({ raisedBy: userId }),
      Grievance.find({ submittedBy: userId }),
      Suggestion.find({ submittedBy: userId }),
      Asset.find({ assignedTo: userId }),
      Notification.find(byUser).sort('-createdAt').limit(500),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    note: 'Personal data held about you in the HR system (UK GDPR subject access request).',
    profile: user.toJSON(),
    attendance: plain(attendance),
    leave: { requests: plain(leaveRequests), balances: plain(leaveBalances), regularizations: plain(regularizations) },
    payslips: plain(payslips),
    expenses: plain(expenses),
    performance: { goals: plain(goals), kpis: plain(kpis), qaFeedback: plain(qaFeedback), ratings: plain(ratings), actionPlans: plain(actionPlans) },
    conduct: { warnings: plain(warnings), escalations: plain(escalations) },
    learning: { training: plain(training), testAttempts: plain(testAttempts) },
    rosters: plain(rosters),
    workStatus: plain(workStatus),
    support: { tickets: plain(tickets), grievances: plain(grievances), suggestions: plain(suggestions) },
    assets: plain(assets),
    notifications: plain(notifications),
  };
}

// First date a leaver may be anonymised: exit date + retention years
export function anonymiseAllowedFrom(user, retentionYears) {
  if (!user.exitDate) return null;
  const exit = toDateStr(user.exitDate);
  const [y, m, d] = exit.split('-').map(Number);
  return addDays(`${y + retentionYears}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, 0);
}

export async function anonymiseEmployee(user) {
  const id = String(user._id);
  user.set({
    firstName: 'Former',
    lastName: `Employee ${user.employeeCode || ''}`.trim(),
    email: `anonymised-${id}@deleted.invalid`,
    phone: undefined,
    gender: undefined,
    dateOfBirth: undefined,
    maritalStatus: undefined,
    bloodGroup: undefined,
    avatar: undefined,
    address: {},
    emergencyContact: {},
    bankDetails: {},
    niNumber: undefined,
    rightToWork: {},
    workLocation: undefined,
    status: 'terminated',
    anonymisedAt: new Date(),
  });
  // Nobody can log in with it any more
  user.password = `${id}-${Date.now()}-${Math.random()}`;
  await user.save();

  await Promise.all([
    Payslip.updateMany(
      { user: user._id },
      { $set: { 'employeeSnapshot.name': `Former Employee ${user.employeeCode || ''}`.trim() }, $unset: { 'employeeSnapshot.niNumber': 1, 'employeeSnapshot.accountNumber': 1, 'employeeSnapshot.sortCode': 1, 'employeeSnapshot.bankName': 1 } }
    ),
    WorkStatusLog.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    Expense.updateMany({ user: user._id }, { $unset: { receiptUrl: 1, description: 1 } }),
  ]);
}
