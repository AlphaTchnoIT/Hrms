import { ActionPlan, QaFeedback, Settings, TrainingAssignment, Warning } from '../models/index.js';
import { WARNING_STAGES } from '../constants/index.js';
import { sendSuccess } from '../utils/response.js';
import { todayInTz } from '../utils/date.js';
import { getScopedUsers, isHR } from '../services/access.service.js';
import { currentRange, getManagerRatings, getPerformanceSummaries } from '../services/performance.service.js';
import { getWorkforce } from '../services/workforce.service.js';
import { activeWarningFilter, evaluateTriggers } from '../services/relations.service.js';

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 };

/*
 * GET /api/workspace/team?manager=
 * My Team Home: only the employees currently assigned to the manager, with today's status,
 * performance snapshot and the reasons each one needs attention.
 */
export async function getTeamWorkspace(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  // Only HR / admin may look at another manager's team
  const managerId = isHR(req.user) ? req.query.manager || undefined : req.user._id;
  const users = await getScopedUsers(req.user, { scope: req.query.scope, managerId });
  const ids = users.map((u) => u._id);

  if (!users.length) {
    return sendSuccess(res, { data: { members: [], counts: { total: 0 }, managerRating: null } });
  }

  const [summaries, todayWorkforce, flags, warnings, plans, pendingQa, overdueTraining, managerRatings] = await Promise.all([
    getPerformanceSummaries(users, { ...currentRange(settings), settings }),
    getWorkforce(users, today, today, settings),
    evaluateTriggers(users, settings),
    Warning.find({ employee: { $in: ids }, ...activeWarningFilter(today) }).select('employee stage status category'),
    ActionPlan.find({ user: { $in: ids }, status: { $in: ['open', 'in-progress'] } }).select('user deadline followUpDate title metric'),
    QaFeedback.aggregate([
      { $match: { user: { $in: ids }, acknowledgedAt: null } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]),
    TrainingAssignment.aggregate([
      { $match: { user: { $in: ids }, status: { $ne: 'completed' }, dueDate: { $lt: today } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]),
    managerId ? getManagerRatings(settings, { managerIds: [managerId] }) : Promise.resolve([]),
  ]);

  const pendingQaMap = Object.fromEntries(pendingQa.map((p) => [String(p._id), p.count]));
  const trainingMap = Object.fromEntries(overdueTraining.map((p) => [String(p._id), p.count]));

  const members = users.map((user) => {
    const id = String(user._id);
    const summary = summaries[id];
    const day = todayWorkforce[id]?.days[0] || null;
    const myWarnings = warnings.filter((w) => String(w.employee) === id);
    const myPlans = plans.filter((p) => String(p.user) === id);
    const overduePlans = myPlans.filter((p) => p.deadline < today);
    const followUps = myPlans.filter((p) => p.followUpDate && p.followUpDate <= today);
    const highestStage = myWarnings.reduce((max, w) => Math.max(max, w.stage), 0);

    const reasons = [];
    Object.entries(summary.metrics).forEach(([metric, m]) => {
      if (m.status === 'critical') reasons.push({ type: 'kpi', severity: 'high', message: `${metric} critical: ${m.score}% vs ${m.target}% target` });
      else if (m.status === 'needs-attention') reasons.push({ type: 'kpi', severity: 'medium', message: `${metric} below target: ${m.score}% vs ${m.target}%` });
    });
    flags
      .filter((f) => f.user === id)
      .forEach((f) => reasons.push({ type: 'trigger', severity: 'high', message: `${f.trigger.name}: ${f.message}`, category: f.trigger.category }));
    if (highestStage) {
      reasons.push({ type: 'warning', severity: highestStage >= 3 ? 'high' : 'medium', message: `Active ${WARNING_STAGES[highestStage].toLowerCase()} (${myWarnings.length} active)` });
    }
    if (overduePlans.length) reasons.push({ type: 'action-plan', severity: 'high', message: `${overduePlans.length} action plan(s) past deadline` });
    if (followUps.length) reasons.push({ type: 'follow-up', severity: 'medium', message: `${followUps.length} action plan follow-up(s) due` });
    if (pendingQaMap[id]) reasons.push({ type: 'qa', severity: 'low', message: `${pendingQaMap[id]} QA feedback not acknowledged` });
    if (trainingMap[id]) reasons.push({ type: 'training', severity: 'low', message: `${trainingMap[id]} training(s) overdue` });
    reasons.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

    return {
      user,
      status: summary.status,
      compositeScore: summary.compositeScore,
      rating: summary.rating,
      metrics: summary.metrics,
      today: day && { status: day.status, shift: day.shift, checkIn: day.checkIn, isLate: day.isLate },
      warnings: { active: myWarnings.length, highestStage },
      actionPlans: { open: myPlans.length, overdue: overduePlans.length },
      reasons,
      needsAttention: reasons.some((r) => r.severity !== 'low'),
    };
  });

  const PRESENT = ['present', 'late-login', 'short-login'];
  const counts = {
    total: members.length,
    presentToday: members.filter((m) => PRESENT.includes(m.today?.status)).length,
    onLeaveToday: members.filter((m) => /leave/.test(m.today?.status || '')).length,
    lateToday: members.filter((m) => m.today?.isLate).length,
    critical: members.filter((m) => m.status === 'critical').length,
    needsAttention: members.filter((m) => m.status === 'needs-attention').length,
    meetingTarget: members.filter((m) => m.status === 'meeting-target').length,
    attentionRequired: members.filter((m) => m.needsAttention).length,
  };

  sendSuccess(res, { data: { members, counts, managerRating: managerRatings[0] || null, today } });
}
