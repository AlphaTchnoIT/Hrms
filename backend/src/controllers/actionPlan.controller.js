import { ActionPlan, KpiRecord, QaFeedback, Settings, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';
import { addDays, todayInTz } from '../utils/date.js';
import { canManageEmployee, getScopedUsers } from '../services/access.service.js';
import { currentRange, getPerformanceSummaries, getPlanProgress } from '../services/performance.service.js';
import { getWorkforce } from '../services/workforce.service.js';
import { notify } from '../services/notification.service.js';

const POPULATE = [
  { path: 'user', select: 'firstName lastName employeeCode avatar' },
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'checkIns.by', select: 'firstName lastName' },
];
const EDITABLE = ['title', 'reason', 'targetScore', 'deadline', 'followUpDate', 'status', 'outcome'];

// Default actions suggested for each KPI when a plan is generated
const ACTION_TEMPLATES = {
  quality: [
    'Review 3 top-scoring interactions with the QA auditor every week',
    'Daily 10-minute refresher on the most repeated error category',
    'Side-by-side coaching session with the team lead twice a week',
  ],
  efficiency: [
    'Shadow a top performer for two sessions to learn faster handling',
    'Use the knowledge base shortcuts / templates for common queries',
    'Weekly review of handling time with the manager',
  ],
  classification: [
    'Complete the classification refresher training',
    'Pass the classification knowledge test with at least 80%',
    'Peer-review 10 classified cases per week',
  ],
  adherence: [
    'Log in 5 minutes before the scheduled shift start',
    'Plan breaks as per the roster; no unplanned breaks',
    'Inform the manager in advance for any schedule change',
  ],
};

async function withProgress(plans) {
  const settings = await Settings.getSettings();
  const progress = await getPlanProgress(plans, settings);
  return plans.map((plan, i) => ({ ...plan.toObject(), progress: progress[i] }));
}

// Average score of the metric in the 14 days before the plan starts
async function getBaseline(user, metric, startDate, settings) {
  const from = addDays(startDate, -14);
  const to = addDays(startDate, -1);
  if (metric === 'adherence') {
    const workforce = await getWorkforce([user], from, to, settings);
    return workforce[String(user._id)]?.summary.adherencePercent ?? null;
  }
  const records = await KpiRecord.find({ user: user._id, metric, date: { $gte: from, $lte: to } });
  if (!records.length) return null;
  return Math.round((records.reduce((s, r) => s + r.score, 0) / records.length) * 10) / 10;
}

// GET /api/action-plans/my
export async function getMyPlans(req, res) {
  const plans = await ActionPlan.find({ user: req.user._id }).populate(POPULATE).sort({ createdAt: -1 });
  sendSuccess(res, { data: await withProgress(plans) });
}

// GET /api/action-plans?user&status&manager
export async function listPlans(req, res) {
  const filter = {};
  if (req.query.user) {
    if (!(await canManageEmployee(req.user, req.query.user))) throw ApiError.forbidden();
    filter.user = req.query.user;
  } else {
    const users = await getScopedUsers(req.user, { managerId: req.query.manager, select: '_id' });
    filter.user = { $in: users.map((u) => u._id) };
  }
  if (req.query.status) filter.status = req.query.status;
  const plans = await ActionPlan.find(filter).populate(POPULATE).sort({ createdAt: -1 }).limit(300);
  sendSuccess(res, { data: await withProgress(plans) });
}

async function loadPlan(req, { manage = false } = {}) {
  const plan = await ActionPlan.findById(req.params.id).populate(POPULATE);
  if (!plan) throw ApiError.notFound('Action plan not found');
  const isOwner = String(plan.user._id) === String(req.user._id);
  const isManager = !isOwner && (await canManageEmployee(req.user, plan.user._id));
  if (manage ? !isManager : !isOwner && !isManager) throw ApiError.forbidden();
  return { plan, isOwner, isManager };
}

// GET /api/action-plans/:id
export async function getPlan(req, res) {
  const { plan } = await loadPlan(req);
  const [data] = await withProgress([plan]);
  sendSuccess(res, { data });
}

/*
 * POST /api/action-plans/suggest { user }
 * Generates draft plans for every KPI where the employee is not meeting target.
 */
export async function suggestPlans(req, res) {
  if (!(await canManageEmployee(req.user, req.body.user))) throw ApiError.forbidden();
  const user = await User.findById(req.body.user);
  if (!user) throw ApiError.notFound('Employee not found');

  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const summary = (await getPerformanceSummaries([user], { ...currentRange(settings), settings }))[String(user._id)];

  // Most repeated QA error categories, to make quality actions specific
  const audits = await QaFeedback.find({ user: user._id, auditDate: { $gte: addDays(today, -60) } }).select('errorCategories');
  const errorCounts = {};
  audits.forEach((a) => a.errorCategories.forEach((c) => (errorCounts[c] = (errorCounts[c] || 0) + 1)));
  const topErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);

  const suggestions = Object.entries(summary.metrics)
    .filter(([, m]) => m.status && m.status !== 'meeting-target')
    .map(([metric, m]) => {
      const actions = [...ACTION_TEMPLATES[metric]];
      if (metric === 'quality' && topErrors.length) actions.unshift(`Focus on repeated errors: ${topErrors.join(', ')}`);
      return {
        user: user._id,
        metric,
        title: `Improve ${metric} from ${m.score}% to ${m.target}%`,
        reason: `${metric[0].toUpperCase()}${metric.slice(1)} is ${m.score}% against a target of ${m.target}% (${m.status.replace('-', ' ')})`,
        targetScore: Math.round(m.target),
        startDate: today,
        deadline: addDays(today, m.status === 'critical' ? 30 : 45),
        followUpDate: addDays(today, 7),
        actions,
        currentScore: m.score,
        status: m.status,
      };
    });

  sendSuccess(res, { data: suggestions });
}

// POST /api/action-plans
export async function createPlan(req, res) {
  if (!(await canManageEmployee(req.user, req.body.user))) throw ApiError.forbidden('You can only create plans for your team');
  const user = await User.findById(req.body.user);
  if (!user) throw ApiError.notFound('Employee not found');
  const settings = await Settings.getSettings();

  const plan = await ActionPlan.create({
    ...pick(req.body, ['user', 'metric', 'title', 'reason', 'targetScore', 'startDate', 'deadline', 'followUpDate']),
    actions: req.body.actions.map((description) => ({ description })),
    baselineScore: await getBaseline(user, req.body.metric, req.body.startDate, settings),
    createdBy: req.user._id,
  });

  notify(user._id, {
    title: 'Action plan assigned',
    message: `"${plan.title}" — please review and acknowledge it`,
    link: '/performance?tab=action-plans',
  });
  sendSuccess(res, { data: plan, message: 'Action plan created', status: 201 });
}

// PUT /api/action-plans/:id (manager)
export async function updatePlan(req, res) {
  const { plan } = await loadPlan(req, { manage: true });
  plan.set(pick(req.body, EDITABLE));
  if (req.body.actions) {
    // Keep "done" state for actions that still exist (matched by text)
    const done = Object.fromEntries(plan.actions.map((a) => [a.description, a]));
    plan.actions = req.body.actions.map((description) => done[description] || { description });
  }
  await plan.save();
  if (['completed', 'closed'].includes(plan.status)) {
    notify(plan.user._id, { title: `Action plan ${plan.status}`, message: plan.title, link: '/performance?tab=action-plans' });
  }
  sendSuccess(res, { data: plan, message: 'Action plan updated' });
}

// POST /api/action-plans/:id/check-ins { note, score, nextFollowUp }
export async function addCheckIn(req, res) {
  const { plan } = await loadPlan(req, { manage: true });
  const settings = await Settings.getSettings();
  plan.checkIns.push({ date: todayInTz(settings.timezone), note: req.body.note, score: req.body.score, by: req.user._id });
  if (req.body.nextFollowUp) plan.followUpDate = req.body.nextFollowUp;
  if (plan.status === 'open') plan.status = 'in-progress';
  await plan.save();
  notify(plan.user._id, { title: 'Action plan follow-up', message: req.body.note, link: '/performance?tab=action-plans' });
  sendSuccess(res, { data: plan, message: 'Follow-up recorded' });
}

// PATCH /api/action-plans/:id/actions/:actionId { isDone }
export async function toggleAction(req, res) {
  const { plan } = await loadPlan(req);
  const action = plan.actions.id(req.params.actionId);
  if (!action) throw ApiError.notFound('Action not found');
  action.isDone = Boolean(req.body.isDone);
  action.doneAt = action.isDone ? new Date() : null;
  if (plan.status === 'open') plan.status = 'in-progress';
  await plan.save();
  sendSuccess(res, { data: plan, message: action.isDone ? 'Action marked done' : 'Action reopened' });
}

// PATCH /api/action-plans/:id/acknowledge { comment } (employee)
export async function acknowledgePlan(req, res) {
  const { plan, isOwner } = await loadPlan(req);
  if (!isOwner) throw ApiError.forbidden('Only the employee can acknowledge their plan');
  plan.employeeAcknowledgedAt = plan.employeeAcknowledgedAt || new Date();
  if (req.body.comment) plan.employeeComment = req.body.comment;
  await plan.save();
  if (plan.createdBy) {
    notify(plan.createdBy._id, { title: 'Action plan acknowledged', message: `${plan.user.firstName} acknowledged "${plan.title}"`, link: '/team/action-plans' });
  }
  sendSuccess(res, { data: plan, message: 'Action plan acknowledged' });
}
