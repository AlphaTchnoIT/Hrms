import { KpiRecord, User } from '../models/index.js';
import { KPI_METRICS, ROLES } from '../constants/index.js';
import { addDays, todayInTz, weekStart } from '../utils/date.js';
import { getWorkforce } from './workforce.service.js';

const STATUS_RANK = { 'meeting-target': 0, 'needs-attention': 1, critical: 2 };
const round1 = (n) => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

/*
 * Target that applies to an employee on a date.
 * Efficiency uses the glide path for new joiners (ramp-up by weeks of tenure).
 */
export function targetFor(metric, user, settings, date) {
  const base = settings.kpiTargets?.[metric] ?? 90;
  if (metric !== 'efficiency' || !user?.dateOfJoining) return base;
  const tenureWeeks = Math.floor((Date.parse(date) - new Date(user.dateOfJoining).getTime()) / (7 * 86400000)) + 1;
  const step = [...(settings.efficiencyGlidePath || [])].sort((a, b) => a.week - b.week).find((s) => tenureWeeks <= s.week);
  return step ? Math.min(step.target, base) : base;
}

// Meeting Target / Needs Attention / Critical using the configurable band
export function statusFor(score, target, band) {
  if (score === null || score === undefined) return null;
  if (score >= target) return 'meeting-target';
  if (score >= target - band) return 'needs-attention';
  return 'critical';
}

export function worstStatus(statuses) {
  return statuses.filter(Boolean).sort((a, b) => STATUS_RANK[b] - STATUS_RANK[a])[0] || null;
}

// achievement = score / target (1 = exactly on target) -> 1..5 rating
export function ratingFromAchievement(achievement) {
  if (achievement === null || achievement === undefined) return null;
  if (achievement >= 1.05) return 5;
  if (achievement >= 1) return 4;
  if (achievement >= 0.95) return 3;
  if (achievement >= 0.85) return 2;
  return 1;
}

export const RATING_LABELS = { 1: 'Unsatisfactory', 2: 'Needs improvement', 3: 'Meets most', 4: 'Meets expectations', 5: 'Exceeds expectations' };

// Default look-back window for "current" performance
export function currentRange(settings, days = 30) {
  const to = todayInTz(settings.timezone);
  return { from: addDays(to, -(days - 1)), to };
}

/*
 * Performance summary per user for a date range:
 *   metrics.{quality|efficiency|classification|adherence} = { score, target, status, latest, records, belowTarget }
 *   compositeScore (weighted score of the 3 rating parameters), achievement, rating (1-5), status (worst metric)
 */
export async function getPerformanceSummaries(users, { from, to, settings }) {
  const userIds = users.map((u) => u._id);
  const [records, workforce] = await Promise.all([
    KpiRecord.find({ user: { $in: userIds }, date: { $gte: from, $lte: to } }).sort('date'),
    getWorkforce(users, from, to, settings),
  ]);

  const byUser = {};
  records.forEach((r) => {
    const id = String(r.user);
    byUser[id] = byUser[id] || {};
    (byUser[id][r.metric] = byUser[id][r.metric] || []).push(r);
  });

  const result = {};
  users.forEach((user) => {
    const id = String(user._id);
    const metrics = {};

    KPI_METRICS.forEach((metric) => {
      const list = byUser[id]?.[metric] || [];
      if (!list.length) {
        metrics[metric] = { score: null, target: targetFor(metric, user, settings, to), status: null, records: 0, belowTarget: 0 };
        return;
      }
      const withTargets = list.map((r) => ({ score: r.score, target: r.target ?? targetFor(metric, user, settings, r.date), date: r.date }));
      const score = average(withTargets.map((r) => r.score));
      const target = average(withTargets.map((r) => r.target));
      const latest = withTargets[withTargets.length - 1];
      metrics[metric] = {
        score: round1(score),
        target: round1(target),
        status: statusFor(score, target, settings.attentionBand),
        latest,
        records: list.length,
        belowTarget: withTargets.filter((r) => r.score < r.target).length,
      };
    });

    const wf = workforce[id]?.summary;
    const adherenceTarget = settings.kpiTargets.adherence;
    metrics.adherence = {
      score: wf?.adherencePercent ?? null,
      target: adherenceTarget,
      status: statusFor(wf?.adherencePercent, adherenceTarget, settings.attentionBand),
      attendancePercent: wf?.attendancePercent ?? null,
      lateLogins: wf?.lateLogins || 0,
      shortLogins: wf?.shortLogins || 0,
      absent: wf?.absent || 0,
    };

    // 3-parameter rating: quality, efficiency, classification (weights renormalised if a metric has no data)
    let weightSum = 0;
    let scoreSum = 0;
    let achievementSum = 0;
    KPI_METRICS.forEach((metric) => {
      const m = metrics[metric];
      const weight = settings.kpiWeights?.[metric] ?? 1;
      if (m.score === null || !weight) return;
      weightSum += weight;
      scoreSum += m.score * weight;
      achievementSum += (m.score / (m.target || 1)) * weight;
    });
    const achievement = weightSum ? achievementSum / weightSum : null;

    result[id] = {
      metrics,
      compositeScore: weightSum ? round1(scoreSum / weightSum) : null,
      achievement: achievement === null ? null : Math.round(achievement * 1000) / 1000,
      rating: ratingFromAchievement(achievement),
      status: worstStatus(Object.values(metrics).map((m) => m.status)),
      workforce: wf || null,
    };
  });

  return result;
}

/*
 * Weekly averages per metric for the last `weeks` weeks.
 * Returns [{ week: "YYYY-MM-DD" (Monday), quality, efficiency, classification }]
 */
export async function getKpiTrend(userIds, settings, weeks = 13) {
  const today = todayInTz(settings.timezone);
  const firstWeek = addDays(weekStart(today), -7 * (weeks - 1));
  const records = await KpiRecord.find({ user: { $in: userIds }, date: { $gte: firstWeek, $lte: today } });

  const buckets = {};
  records.forEach((r) => {
    const week = weekStart(r.date);
    buckets[week] = buckets[week] || {};
    (buckets[week][r.metric] = buckets[week][r.metric] || []).push(r.score);
  });

  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(firstWeek, i * 7);
    const point = { week };
    KPI_METRICS.forEach((metric) => (point[metric] = round1(average(buckets[week]?.[metric] || []))));
    return point;
  });
}

/*
 * Manager rating based on the team's performance:
 * average achievement of the direct reports (with KPI data) -> 1..5, plus status counts.
 */
export async function getManagerRatings(settings, { managerIds } = {}) {
  const managerFilter = { status: 'active', role: { $in: [ROLES.MANAGER, ROLES.HR, ROLES.ADMIN] } };
  if (managerIds) managerFilter._id = { $in: managerIds };
  const managers = await User.find(managerFilter).select('firstName lastName employeeCode avatar role');
  const team = await User.find({ status: 'active', reportingManager: { $in: managers.map((m) => m._id) } }).select(
    'firstName lastName reportingManager dateOfJoining'
  );
  if (!team.length) return [];

  const range = currentRange(settings);
  const summaries = await getPerformanceSummaries(team, { ...range, settings });

  return managers
    .map((manager) => {
      const members = team.filter((m) => String(m.reportingManager) === String(manager._id));
      if (!members.length) return null;
      const rows = members.map((m) => summaries[String(m._id)]);
      const achievements = rows.map((r) => r.achievement).filter((a) => a !== null);
      const teamAchievement = average(achievements);
      const counts = { 'meeting-target': 0, 'needs-attention': 0, critical: 0, 'no-data': 0 };
      rows.forEach((r) => (counts[r.status || 'no-data'] += 1));
      const avgOf = (metric) => round1(average(rows.map((r) => r.metrics[metric].score).filter((s) => s !== null)));

      return {
        manager,
        teamSize: members.length,
        teamAchievement: teamAchievement === null ? null : Math.round(teamAchievement * 1000) / 1000,
        rating: ratingFromAchievement(teamAchievement),
        averages: {
          quality: avgOf('quality'),
          efficiency: avgOf('efficiency'),
          classification: avgOf('classification'),
          adherence: avgOf('adherence'),
          composite: round1(average(rows.map((r) => r.compositeScore).filter((s) => s !== null))),
        },
        statusCounts: counts,
        needsAttention: counts.critical + counts['needs-attention'] > 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.teamAchievement ?? -1) - (a.teamAchievement ?? -1));
}

/*
 * Forward performance of action plans: weekly scores of the plan's KPI since the plan started,
 * compared with the baseline captured when the plan was created.
 */
export async function getPlanProgress(plans, settings) {
  if (!plans.length) return [];
  const today = todayInTz(settings.timezone);
  const earliest = plans.reduce((min, p) => (p.startDate < min ? p.startDate : min), today);
  const userIds = [...new Set(plans.map((p) => String(p.user?._id || p.user)))];

  const [records, users] = await Promise.all([
    KpiRecord.find({ user: { $in: userIds }, date: { $gte: earliest } }).sort('date'),
    plans.some((p) => p.metric === 'adherence') ? User.find({ _id: { $in: userIds } }).select('dateOfJoining') : [],
  ]);
  const workforce = users.length ? await getWorkforce(users, earliest, today, settings) : {};

  return plans.map((plan) => {
    const userId = String(plan.user?._id || plan.user);
    let points;
    if (plan.metric === 'adherence') {
      const days = (workforce[userId]?.days || []).filter((d) => d.date >= plan.startDate && d.scheduledMinutes && d.status !== 'scheduled');
      const weeksMap = {};
      days.forEach((d) => {
        const week = weekStart(d.date);
        weeksMap[week] = weeksMap[week] || { ok: 0, total: 0 };
        if (['present', 'late-login', 'short-login', 'absent'].includes(d.status)) {
          weeksMap[week].total += 1;
          if (d.status === 'present') weeksMap[week].ok += 1;
        }
      });
      points = Object.entries(weeksMap)
        .filter(([, v]) => v.total)
        .map(([week, v]) => ({ week, score: round1((v.ok / v.total) * 100) }));
    } else {
      const weeksMap = {};
      records
        .filter((r) => String(r.user) === userId && r.metric === plan.metric && r.date >= plan.startDate)
        .forEach((r) => (weeksMap[weekStart(r.date)] = [...(weeksMap[weekStart(r.date)] || []), r.score]));
      points = Object.entries(weeksMap).map(([week, scores]) => ({ week, score: round1(average(scores)) }));
    }
    points.sort((a, b) => a.week.localeCompare(b.week));

    const latest = points.length ? points[points.length - 1].score : null;
    const sinceStart = round1(average(points.map((p) => p.score)));
    const baseline = plan.baselineScore ?? null;
    const totalDays = Math.max(1, (Date.parse(plan.deadline) - Date.parse(plan.startDate)) / 86400000);
    const elapsed = Math.min(1, Math.max(0, (Date.parse(today) - Date.parse(plan.startDate)) / 86400000 / totalDays));
    const expected = baseline === null ? plan.targetScore : round1(baseline + (plan.targetScore - baseline) * elapsed);

    let trajectory = 'no-data';
    if (latest !== null) {
      if (latest >= plan.targetScore) trajectory = 'target-achieved';
      else if (latest >= expected) trajectory = 'on-track';
      else if (baseline !== null && latest > baseline) trajectory = 'improving';
      else trajectory = 'off-track';
    }

    const actionsDone = plan.actions.filter((a) => a.isDone).length;
    return {
      planId: plan._id,
      points,
      latestScore: latest,
      averageSinceStart: sinceStart,
      baselineScore: baseline,
      improvement: latest !== null && baseline !== null ? round1(latest - baseline) : null,
      expectedScore: expected,
      trajectory,
      timeElapsedPercent: Math.round(elapsed * 100),
      actionsDone,
      actionsTotal: plan.actions.length,
      isOverdue: !['completed', 'closed'].includes(plan.status) && plan.deadline < today,
      followUpDue: !['completed', 'closed'].includes(plan.status) && Boolean(plan.followUpDate) && plan.followUpDate <= today,
    };
  });
}
