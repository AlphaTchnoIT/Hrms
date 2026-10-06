import { ActionPlan, KpiRecord, RatingReview, Settings, User } from '../models/index.js';
import { ROLES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { addDays, daysInMonth, isValidDateStr, todayInTz, weekStart } from '../utils/date.js';
import { canAuditEmployee, canManageEmployee, getScopedUsers, isHR, isManager, isQA } from '../services/access.service.js';
import {
  RATING_LABELS,
  currentRange,
  getKpiTrend,
  getManagerRatings,
  getPerformanceSummaries,
  getPlanProgress,
  targetFor,
} from '../services/performance.service.js';
import { getAdherenceTrend } from '../services/workforce.service.js';
import { notify } from '../services/notification.service.js';

const PLAN_POPULATE = [
  { path: 'user', select: 'firstName lastName employeeCode avatar' },
  { path: 'createdBy', select: 'firstName lastName' },
];
const RATING_POPULATE = [
  { path: 'user', select: 'firstName lastName employeeCode avatar reportingManager' },
  { path: 'qaApproval.by', select: 'firstName lastName' },
  { path: 'hrApproval.by', select: 'firstName lastName' },
];

// Everything shown on one employee's KPI dashboard (current + historical)
async function buildEmployeePerformance(user, settings, { approvedRatingsOnly = false } = {}) {
  const current = currentRange(settings);
  const previous = { from: addDays(current.from, -30), to: addDays(current.from, -1) };

  const [summaries, previousSummaries, trend, adherence, recent, plans, ratings] = await Promise.all([
    getPerformanceSummaries([user], { ...current, settings }),
    getPerformanceSummaries([user], { ...previous, settings }),
    getKpiTrend([user._id], settings, 13),
    getAdherenceTrend([user], settings, 3),
    KpiRecord.find({ user: user._id }).populate('recordedBy', 'firstName lastName').sort({ date: -1 }).limit(30),
    ActionPlan.find({ user: user._id }).populate(PLAN_POPULATE).sort({ createdAt: -1 }).limit(20),
    RatingReview.find({ user: user._id, ...(approvedRatingsOnly ? { status: 'approved' } : {}) }).populate(RATING_POPULATE).sort({ period: -1 }).limit(6),
  ]);

  const progress = await getPlanProgress(plans, settings);
  const today = todayInTz(settings.timezone);

  return {
    user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, employeeCode: user.employeeCode, avatar: user.avatar, dateOfJoining: user.dateOfJoining },
    range: current,
    current: summaries[String(user._id)],
    previous: previousSummaries[String(user._id)],
    trend,
    adherenceTrend: adherence.perUser[String(user._id)] || [],
    recentKpis: recent,
    actionPlans: plans.map((plan, i) => ({ ...plan.toObject(), progress: progress[i] })),
    ratings,
    targets: {
      quality: settings.kpiTargets.quality,
      efficiency: targetFor('efficiency', user, settings, today), // glide path applied
      classification: settings.kpiTargets.classification,
      adherence: settings.kpiTargets.adherence,
    },
    weights: settings.kpiWeights,
    ratingLabels: RATING_LABELS,
  };
}

// GET /api/performance/my
export async function getMyPerformance(req, res) {
  const settings = await Settings.getSettings();
  const data = await buildEmployeePerformance(req.user, settings, { approvedRatingsOnly: true });

  // Managers also see the rating they get from their team's performance
  if (isHR(req.user) || isManager(req.user)) {
    [data.managerRating] = await getManagerRatings(settings, { managerIds: [req.user._id] });
  }
  sendSuccess(res, { data });
}

// GET /api/performance/employee/:id
export async function getEmployeePerformance(req, res) {
  if (!(await canAuditEmployee(req.user, req.params.id))) throw ApiError.forbidden();
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Employee not found');
  const settings = await Settings.getSettings();
  sendSuccess(res, { data: await buildEmployeePerformance(user, settings) });
}

// GET /api/performance/team?manager=&days=30 - team performance dashboard
export async function getTeamPerformance(req, res) {
  const settings = await Settings.getSettings();
  // Only HR / admin may look at another manager's team
  const managerId = isHR(req.user) ? req.query.manager || undefined : req.user._id;
  const users = await getScopedUsers(req.user, { scope: req.query.scope, managerId });
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 90);
  const range = currentRange(settings, days);

  if (!users.length) {
    return sendSuccess(res, { data: { range, members: [], trend: [], adherenceTrend: [], managerRating: null } });
  }

  const [summaries, trend, adherence, managerRatings] = await Promise.all([
    getPerformanceSummaries(users, { ...range, settings }),
    getKpiTrend(users.map((u) => u._id), settings, 13),
    getAdherenceTrend(users, settings, 3),
    managerId ? getManagerRatings(settings, { managerIds: [managerId] }) : Promise.resolve([]),
  ]);

  const members = users.map((user) => ({ user, ...summaries[String(user._id)] }));
  const counts = { 'meeting-target': 0, 'needs-attention': 0, critical: 0, 'no-data': 0 };
  members.forEach((m) => (counts[m.status || 'no-data'] += 1));

  sendSuccess(res, {
    data: {
      range,
      members,
      statusCounts: counts,
      trend,
      adherenceTrend: adherence.all,
      managerRating: managerRatings[0] || null,
      targets: settings.toObject().kpiTargets,
    },
  });
}

// GET /api/performance/manager-ratings - managers rated on their team's performance
export async function listManagerRatings(req, res) {
  const settings = await Settings.getSettings();
  const managerIds = isHR(req.user) ? undefined : [req.user._id];
  sendSuccess(res, { data: await getManagerRatings(settings, { managerIds }) });
}

/* ------------------------------- KPI records ------------------------------- */

// GET /api/performance/kpis?user&metric&from&to
export async function listKpis(req, res) {
  const filter = {};
  if (req.query.user) {
    if (!(await canAuditEmployee(req.user, req.query.user))) throw ApiError.forbidden();
    filter.user = req.query.user;
  } else {
    const users = await getScopedUsers(req.user, { scope: req.query.scope, select: '_id' });
    filter.user = { $in: users.map((u) => u._id) };
  }
  if (req.query.metric) filter.metric = req.query.metric;
  if (isValidDateStr(req.query.from) || isValidDateStr(req.query.to)) {
    filter.date = {};
    if (isValidDateStr(req.query.from)) filter.date.$gte = req.query.from;
    if (isValidDateStr(req.query.to)) filter.date.$lte = req.query.to;
  }

  const records = await KpiRecord.find(filter)
    .populate('user', 'firstName lastName employeeCode avatar')
    .populate('recordedBy', 'firstName lastName')
    .sort({ date: -1, createdAt: -1 })
    .limit(500);
  sendSuccess(res, { data: records });
}

async function saveKpi(entry, currentUser, settings) {
  if (!(await canAuditEmployee(currentUser, entry.user))) {
    throw ApiError.forbidden('You can only record KPIs for employees you manage');
  }
  // Only QA / HR may record quality scores directly; managers record efficiency & classification
  if (entry.metric === 'quality' && !isHR(currentUser) && !isQA(currentUser)) {
    throw ApiError.field('metric', 'Quality scores are recorded by the QA team');
  }
  const user = await User.findById(entry.user).select('dateOfJoining');
  const date = entry.period === 'weekly' ? weekStart(entry.date) : entry.date;
  const target = entry.target ?? targetFor(entry.metric, user, settings, date);

  return KpiRecord.findOneAndUpdate(
    { user: entry.user, metric: entry.metric, period: entry.period, date },
    { $set: { score: entry.score, target, remarks: entry.remarks, recordedBy: currentUser._id, source: 'manual' } },
    { new: true, upsert: true, runValidators: true }
  );
}

// POST /api/performance/kpis - create or update a daily/weekly KPI result
export async function upsertKpi(req, res) {
  const settings = await Settings.getSettings();
  const record = await saveKpi(req.body, req.user, settings);
  sendSuccess(res, { data: record, message: 'KPI result saved', status: 201 });
}

// POST /api/performance/kpis/bulk - { entries: [...] }
export async function bulkUpsertKpis(req, res) {
  const settings = await Settings.getSettings();
  const saved = [];
  for (const entry of req.body.entries) saved.push(await saveKpi(entry, req.user, settings));
  sendSuccess(res, { data: saved, message: `${saved.length} KPI result(s) saved`, status: 201 });
}

// DELETE /api/performance/kpis/:id
export async function deleteKpi(req, res) {
  const record = await KpiRecord.findById(req.params.id);
  if (!record) throw ApiError.notFound('KPI record not found');
  if (!(await canAuditEmployee(req.user, record.user))) throw ApiError.forbidden();
  // Quality scores belong to the QA team (same rule as recording them)
  if (record.metric === 'quality' && !isHR(req.user) && !isQA(req.user)) throw ApiError.forbidden('Quality scores are managed by the QA team');
  await record.deleteOne();
  sendSuccess(res, { message: 'KPI record deleted' });
}

/* ------------------------------- Monthly rating (HR + QA approval) ------------------------------- */

// POST /api/performance/ratings/generate { period: "YYYY-MM", manager? }
export async function generateRatings(req, res) {
  const settings = await Settings.getSettings();
  const { period } = req.body;
  const [year, month] = period.split('-').map(Number);
  const from = `${period}-01`;
  const to = `${period}-${String(daysInMonth(year, month)).padStart(2, '0')}`;
  if (from > todayInTz(settings.timezone)) throw ApiError.field('period', 'Cannot rate a future month');

  const users = await getScopedUsers(req.user, { scope: req.query.scope, managerId: req.body.manager || (isHR(req.user) ? undefined : req.user._id) });
  if (!users.length) throw ApiError.badRequest('No team members to rate');
  const summaries = await getPerformanceSummaries(users, { from, to, settings });

  let created = 0;
  let skipped = 0;
  for (const user of users) {
    const s = summaries[String(user._id)];
    if (!s.rating) {
      skipped += 1;
      continue;
    }
    const existing = await RatingReview.findOne({ user: user._id, period });
    if (existing?.status === 'approved') {
      skipped += 1;
      continue;
    }
    const scores = {
      quality: s.metrics.quality.score,
      efficiency: s.metrics.efficiency.score,
      classification: s.metrics.classification.score,
      adherence: s.metrics.adherence.score,
    };
    await RatingReview.findOneAndUpdate(
      { user: user._id, period },
      {
        $set: {
          scores,
          compositeScore: s.compositeScore,
          systemRating: s.rating,
          finalRating: s.rating,
          status: 'pending-approval',
          qaApproval: {},
          hrApproval: {},
          generatedBy: req.user._id,
        },
      },
      { upsert: true }
    );
    created += 1;
  }

  sendSuccess(res, {
    message: `${created} rating(s) generated for ${period}${skipped ? `, ${skipped} skipped (no KPI data or already approved)` : ''}`,
    data: { created, skipped },
  });
}

// GET /api/performance/ratings?period&status&manager
export async function listRatings(req, res) {
  const users = await getScopedUsers(req.user, { scope: req.query.scope, managerId: req.query.manager, select: '_id' });
  const filter = { user: { $in: users.map((u) => u._id) } };
  if (req.query.period) filter.period = req.query.period;
  if (req.query.status) filter.status = req.query.status;
  const ratings = await RatingReview.find(filter).populate(RATING_POPULATE).sort({ period: -1, createdAt: -1 }).limit(500);
  sendSuccess(res, { data: ratings });
}

// PATCH /api/performance/ratings/:id - manager / HR adjusts the final rating (approvals restart)
export async function updateRating(req, res) {
  const review = await RatingReview.findById(req.params.id);
  if (!review) throw ApiError.notFound('Rating not found');
  if (!(await canManageEmployee(req.user, review.user))) throw ApiError.forbidden();
  if (review.status === 'approved') throw ApiError.badRequest('This rating is already approved by HR and QA');

  review.finalRating = req.body.finalRating;
  if (req.body.managerComment !== undefined) review.managerComment = req.body.managerComment;
  if (review.finalRating !== review.systemRating && !review.managerComment) {
    throw ApiError.field('managerComment', 'Please explain why the rating differs from the system rating');
  }
  review.qaApproval = {};
  review.hrApproval = {};
  review.status = 'pending-approval';
  await review.save();
  sendSuccess(res, { data: review, message: 'Rating updated and sent for approval' });
}

/*
 * PATCH /api/performance/ratings/:id/approve { approved, comment }
 * QA approves the quality side, HR approves the overall rating. Both = approved. Any rejection = disputed.
 */
export async function approveRating(req, res) {
  const review = await RatingReview.findById(req.params.id);
  if (!review) throw ApiError.notFound('Rating not found');
  if (review.status === 'approved') throw ApiError.badRequest('This rating is already approved');

  // Admin can sign either side; HR signs the HR side; QA signs the QA side
  let side = req.body.side;
  if (isQA(req.user)) side = 'qa';
  else if (req.user.role === ROLES.HR) side = 'hr';
  else if (req.user.role !== ROLES.ADMIN) throw ApiError.forbidden();
  if (!['qa', 'hr'].includes(side)) throw ApiError.field('side', 'Choose which side you are approving for');
  if (!req.body.approved && !req.body.comment) throw ApiError.field('comment', 'Please give a reason for disputing the rating');

  review[`${side}Approval`] = { by: req.user._id, at: new Date(), approved: req.body.approved, comment: req.body.comment };

  if (review.qaApproval?.approved === false || review.hrApproval?.approved === false) review.status = 'disputed';
  else if (review.qaApproval?.approved && review.hrApproval?.approved) review.status = 'approved';
  else review.status = 'pending-approval';
  await review.save();

  if (review.status === 'approved') {
    notify(review.user, {
      title: 'Monthly rating published',
      message: `Your ${review.period} rating is ${review.finalRating}/5 (${RATING_LABELS[review.finalRating]})`,
      link: '/performance',
    });
  }
  const populated = await RatingReview.findById(review._id).populate(RATING_POPULATE);
  sendSuccess(res, { data: populated, message: review.status === 'disputed' ? 'Rating marked as disputed' : 'Approval recorded' });
}

// GET /api/performance/ratings/my - approved ratings only
export async function getMyRatings(req, res) {
  const ratings = await RatingReview.find({ user: req.user._id, status: 'approved' }).sort({ period: -1 });
  sendSuccess(res, { data: ratings });
}

// PATCH /api/performance/ratings/:id/acknowledge
export async function acknowledgeRating(req, res) {
  const review = await RatingReview.findOne({ _id: req.params.id, user: req.user._id, status: 'approved' });
  if (!review) throw ApiError.notFound('Rating not found');
  review.employeeAcknowledgedAt = review.employeeAcknowledgedAt || new Date();
  await review.save();
  sendSuccess(res, { data: review, message: 'Rating acknowledged' });
}
