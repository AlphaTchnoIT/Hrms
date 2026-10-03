import { Calibration, Interaction, KpiRecord, QaFeedback, Settings, User } from '../models/index.js';
import { ROLES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { addDays, isValidDateStr, todayInTz, weekStart } from '../utils/date.js';
import { canAuditEmployee, getScopedUsers, isQA } from '../services/access.service.js';
import { targetFor } from '../services/performance.service.js';
import { notify, notifyMany } from '../services/notification.service.js';

const FEEDBACK_POPULATE = [
  { path: 'user', select: 'firstName lastName employeeCode avatar' },
  { path: 'auditor', select: 'firstName lastName' },
];
const CALIBRATION_POPULATE = [
  { path: 'interaction', populate: { path: 'agent', select: 'firstName lastName employeeCode avatar' } },
  { path: 'managerAudit.auditor', select: 'firstName lastName' },
  { path: 'qaAudit.auditor', select: 'firstName lastName' },
  { path: 'managerSignOff.by', select: 'firstName lastName' },
  { path: 'qaSignOff.by', select: 'firstName lastName' },
];

/*
 * The weekly QA KPI = average of that week's audits (a fatal error counts as 0).
 * Re-calculated every time an audit is added or removed.
 */
async function syncWeeklyQuality(userId, auditDate) {
  const week = weekStart(auditDate);
  const audits = await QaFeedback.find({ user: userId, auditDate: { $gte: week, $lte: addDays(week, 6) } });
  const filter = { user: userId, metric: 'quality', period: 'weekly', date: week };

  if (!audits.length) {
    await KpiRecord.deleteOne({ ...filter, source: 'qa-audit' });
    return;
  }
  const settings = await Settings.getSettings();
  const user = await User.findById(userId).select('dateOfJoining');
  const score = Math.round((audits.reduce((s, a) => s + (a.isFatal ? 0 : a.score), 0) / audits.length) * 10) / 10;
  await KpiRecord.findOneAndUpdate(
    filter,
    {
      $set: {
        score,
        target: targetFor('quality', user, settings, week),
        source: 'qa-audit',
        remarks: `Average of ${audits.length} QA audit(s)`,
      },
    },
    { upsert: true }
  );
}

/* ------------------------------- Interactions ------------------------------- */

// GET /api/quality/interactions?agent&from&to
export async function listInteractions(req, res) {
  const users = await getScopedUsers(req.user, { select: '_id' });
  const filter = { agent: { $in: users.map((u) => u._id) } };
  if (req.query.agent) {
    if (!(await canAuditEmployee(req.user, req.query.agent))) throw ApiError.forbidden();
    filter.agent = req.query.agent;
  }
  if (isValidDateStr(req.query.from)) filter.resolvedAt = { $gte: new Date(req.query.from) };
  const items = await Interaction.find(filter)
    .populate('agent', 'firstName lastName employeeCode avatar')
    .sort({ resolvedAt: -1 })
    .limit(300);
  sendSuccess(res, { data: items });
}

// POST /api/quality/interactions
export async function createInteraction(req, res) {
  if (!(await canAuditEmployee(req.user, req.body.agent))) throw ApiError.forbidden();
  const interaction = await Interaction.create({ ...req.body, createdBy: req.user._id });
  sendSuccess(res, { data: interaction, message: 'Interaction logged', status: 201 });
}

/* ------------------------------- QA feedback ------------------------------- */

// POST /api/quality/feedback
export async function createFeedback(req, res) {
  if (!(await canAuditEmployee(req.user, req.body.user))) throw ApiError.forbidden('You cannot audit this employee');
  const feedback = await QaFeedback.create({ ...req.body, auditor: req.user._id });
  await syncWeeklyQuality(feedback.user, feedback.auditDate);

  notify(feedback.user, {
    title: feedback.isFatal ? 'QA audit: fatal error recorded' : 'New QA feedback',
    message: `Score ${feedback.isFatal ? '0 (fatal)' : `${feedback.score}%`} for ${feedback.interactionRef || 'an interaction'} — please review and acknowledge`,
    link: '/quality',
  });
  sendSuccess(res, { data: feedback, message: 'QA feedback recorded', status: 201 });
}

// GET /api/quality/feedback?user&from&to&pending=true
export async function listFeedback(req, res) {
  const filter = {};
  if (req.query.user) {
    if (!(await canAuditEmployee(req.user, req.query.user))) throw ApiError.forbidden();
    filter.user = req.query.user;
  } else {
    const users = await getScopedUsers(req.user, { managerId: req.query.manager, select: '_id' });
    filter.user = { $in: users.map((u) => u._id) };
  }
  if (isValidDateStr(req.query.from)) filter.auditDate = { $gte: req.query.from };
  if (isValidDateStr(req.query.to)) filter.auditDate = { ...(filter.auditDate || {}), $lte: req.query.to };
  if (req.query.pending === 'true') filter.acknowledgedAt = null;

  const items = await QaFeedback.find(filter).populate(FEEDBACK_POPULATE).sort({ auditDate: -1, createdAt: -1 }).limit(500);
  sendSuccess(res, { data: items });
}

// GET /api/quality/feedback/my
export async function getMyFeedback(req, res) {
  const items = await QaFeedback.find({ user: req.user._id }).populate(FEEDBACK_POPULATE).sort({ auditDate: -1 }).limit(200);
  sendSuccess(res, { data: items });
}

// PATCH /api/quality/feedback/:id/acknowledge { comment }
export async function acknowledgeFeedback(req, res) {
  const feedback = await QaFeedback.findOne({ _id: req.params.id, user: req.user._id });
  if (!feedback) throw ApiError.notFound('Feedback not found');
  if (feedback.acknowledgedAt) throw ApiError.badRequest('You have already acknowledged this feedback');
  feedback.acknowledgedAt = new Date();
  feedback.employeeComment = req.body.comment;
  await feedback.save();
  sendSuccess(res, { data: feedback, message: 'Feedback acknowledged' });
}

// DELETE /api/quality/feedback/:id
export async function deleteFeedback(req, res) {
  const feedback = await QaFeedback.findById(req.params.id);
  if (!feedback) throw ApiError.notFound('Feedback not found');
  const isAuthor = String(feedback.auditor) === String(req.user._id);
  if (!isAuthor && ![ROLES.ADMIN, ROLES.HR].includes(req.user.role)) throw ApiError.forbidden();
  await feedback.deleteOne();
  await syncWeeklyQuality(feedback.user, feedback.auditDate);
  sendSuccess(res, { message: 'Feedback deleted' });
}

// GET /api/quality/repeated-errors?days=90&manager - same error category 2+ times
export async function getRepeatedErrors(req, res) {
  const settings = await Settings.getSettings();
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
  const since = addDays(todayInTz(settings.timezone), -(days - 1));
  const users = await getScopedUsers(req.user, { managerId: req.query.manager });
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

  const rows = await QaFeedback.aggregate([
    { $match: { user: { $in: users.map((u) => u._id) }, auditDate: { $gte: since } } },
    { $unwind: '$errorCategories' },
    {
      $group: {
        _id: { user: '$user', category: '$errorCategories' },
        count: { $sum: 1 },
        lastDate: { $max: '$auditDate' },
        unacknowledged: { $sum: { $cond: [{ $ifNull: ['$acknowledgedAt', false] }, 0, 1] } },
      },
    },
    { $match: { count: { $gte: 2 } } },
    { $sort: { count: -1, lastDate: -1 } },
  ]);

  sendSuccess(res, {
    data: rows.map((r) => ({
      user: userMap[String(r._id.user)],
      category: r._id.category,
      count: r.count,
      lastDate: r.lastDate,
      unacknowledged: r.unacknowledged,
    })),
  });
}

/* ------------------------------- Calibration ------------------------------- */

// Which side of a calibration the user audits for
function calibrationSide(user, requested) {
  if (isQA(user)) return 'qa';
  if ([ROLES.MANAGER, ROLES.HR].includes(user.role)) return 'manager';
  if (user.role === ROLES.ADMIN && ['qa', 'manager'].includes(requested)) return requested;
  if (user.role === ROLES.ADMIN) throw ApiError.field('side', 'Choose whether you audit as QA or as manager');
  throw ApiError.forbidden();
}

// A manager may audit / sign off only calibrations of their own team's interactions
async function assertAgentManager(calibration, side, user) {
  if (side !== 'manager' || user.role !== ROLES.MANAGER) return;
  const agent = await User.findById(calibration.interaction.agent).select('reportingManager');
  if (String(agent?.reportingManager) !== String(user._id)) throw ApiError.forbidden("Only the agent's manager can act on this calibration");
}

// Hide the other side's score until both audits are submitted (blind calibration)
function maskCalibration(calibration, user) {
  const data = calibration.toObject();
  if (data.status === 'pending' && user.role !== ROLES.ADMIN) {
    const mine = isQA(user) ? 'qaAudit' : 'managerAudit';
    const other = mine === 'qaAudit' ? 'managerAudit' : 'qaAudit';
    if (data[other]?.score !== undefined) data[other] = { submitted: true, at: data[other].at };
    data.mySide = mine === 'qaAudit' ? 'qa' : 'manager';
  }
  return data;
}

// POST /api/quality/calibrations/select { frequency } - randomly pick a resolved interaction
export async function selectCalibration(req, res) {
  const frequency = req.body.frequency === 'daily' ? 'daily' : 'weekly';
  const used = await Calibration.distinct('interaction');
  const windows = frequency === 'daily' ? [1, 7, 30] : [7, 30, 90];

  let interaction = null;
  for (const days of windows) {
    const [picked] = await Interaction.aggregate([
      { $match: { _id: { $nin: used }, resolvedAt: { $gte: new Date(Date.now() - days * 86400000), $lte: new Date() } } },
      { $sample: { size: 1 } },
    ]);
    if (picked) {
      interaction = picked;
      break;
    }
  }
  if (!interaction) throw ApiError.badRequest('No resolved interactions available for calibration. Log some interactions first.');

  const calibration = await Calibration.create({ interaction: interaction._id, frequency, selectedBy: req.user._id });

  // Let the agent's manager and the QA team know
  const [agent, qaTeam] = await Promise.all([
    User.findById(interaction.agent).select('reportingManager'),
    User.find({ role: ROLES.QA, status: 'active' }).distinct('_id'),
  ]);
  notifyMany([agent?.reportingManager, ...qaTeam], {
    title: 'New calibration selected',
    message: `Interaction ${interaction.reference} needs an independent audit`,
    link: '/quality/calibration',
  });

  const populated = await Calibration.findById(calibration._id).populate(CALIBRATION_POPULATE);
  sendSuccess(res, { data: maskCalibration(populated, req.user), message: `Interaction ${interaction.reference} selected`, status: 201 });
}

// GET /api/quality/calibrations?status
export async function listCalibrations(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  // Managers only see calibrations of their own team's interactions
  if (req.user.role === ROLES.MANAGER) {
    const team = await User.find({ reportingManager: req.user._id }).distinct('_id');
    filter.interaction = { $in: await Interaction.find({ agent: { $in: team } }).distinct('_id') };
  }
  const items = await Calibration.find(filter).populate(CALIBRATION_POPULATE).sort({ createdAt: -1 }).limit(200);
  sendSuccess(res, { data: items.map((c) => maskCalibration(c, req.user)) });
}

// GET /api/quality/calibrations/summary - calibration accuracy
export async function getCalibrationSummary(_req, res) {
  const settings = await Settings.getSettings();
  const scored = await Calibration.find({ status: { $in: ['scored', 'agreed'] } })
    .populate('managerAudit.auditor', 'firstName lastName')
    .populate('qaAudit.auditor', 'firstName lastName');

  const byAuditor = {};
  scored.forEach((c) => {
    ['managerAudit', 'qaAudit'].forEach((side) => {
      const auditor = c[side].auditor;
      if (!auditor) return;
      const id = String(auditor._id);
      byAuditor[id] = byAuditor[id] || { auditor, side: side === 'qaAudit' ? 'qa' : 'manager', count: 0, accuracySum: 0, aligned: 0 };
      byAuditor[id].count += 1;
      byAuditor[id].accuracySum += c.accuracy;
      if (c.isAligned) byAuditor[id].aligned += 1;
    });
  });

  const total = scored.length;
  sendSuccess(res, {
    data: {
      total,
      pending: await Calibration.countDocuments({ status: 'pending' }),
      averageAccuracy: total ? Math.round((scored.reduce((s, c) => s + c.accuracy, 0) / total) * 10) / 10 : null,
      alignedPercent: total ? Math.round((scored.filter((c) => c.isAligned).length / total) * 1000) / 10 : null,
      agreed: scored.filter((c) => c.status === 'agreed').length,
      tolerance: settings.calibrationTolerance,
      auditors: Object.values(byAuditor).map((a) => ({
        auditor: a.auditor,
        side: a.side,
        count: a.count,
        averageAccuracy: Math.round((a.accuracySum / a.count) * 10) / 10,
        alignedPercent: Math.round((a.aligned / a.count) * 1000) / 10,
      })),
    },
  });
}

// POST /api/quality/calibrations/:id/audit { score, notes, side? }
export async function submitCalibrationAudit(req, res) {
  const calibration = await Calibration.findById(req.params.id).populate('interaction');
  if (!calibration) throw ApiError.notFound('Calibration not found');
  if (calibration.status !== 'pending') throw ApiError.badRequest('Both audits are already submitted');

  const side = calibrationSide(req.user, req.body.side);
  await assertAgentManager(calibration, side, req.user);
  const key = side === 'qa' ? 'qaAudit' : 'managerAudit';
  if (calibration[key]?.score !== undefined && calibration[key]?.score !== null) {
    throw ApiError.badRequest('This side has already submitted its audit');
  }
  calibration[key] = { auditor: req.user._id, score: req.body.score, notes: req.body.notes, at: new Date() };

  const m = calibration.managerAudit?.score;
  const q = calibration.qaAudit?.score;
  if (m !== undefined && m !== null && q !== undefined && q !== null) {
    const settings = await Settings.getSettings();
    calibration.variance = Math.abs(m - q);
    calibration.accuracy = Math.max(0, 100 - calibration.variance);
    calibration.isAligned = calibration.variance <= settings.calibrationTolerance;
    calibration.status = 'scored';
    notifyMany([calibration.managerAudit.auditor, calibration.qaAudit.auditor], {
      title: 'Calibration scored',
      message: `${calibration.interaction.reference}: variance ${calibration.variance} points (${calibration.isAligned ? 'aligned' : 'not aligned'}). Please agree on a final score.`,
      link: '/quality/calibration',
    });
  }
  await calibration.save();
  const populated = await Calibration.findById(calibration._id).populate(CALIBRATION_POPULATE);
  sendSuccess(res, { data: maskCalibration(populated, req.user), message: 'Audit submitted' });
}

/*
 * POST /api/quality/calibrations/:id/sign-off { agreedScore, comment, side? }
 * Mutual approval: the manager/HR side and the QA side must both sign off the same agreed score.
 * Proposing a different score clears the other side's sign-off.
 */
export async function signOffCalibration(req, res) {
  const calibration = await Calibration.findById(req.params.id).populate('interaction', 'agent');
  if (!calibration) throw ApiError.notFound('Calibration not found');
  if (calibration.status === 'pending') throw ApiError.badRequest('Both audits must be submitted before sign-off');
  if (calibration.status === 'agreed') throw ApiError.badRequest('This calibration is already agreed');

  const side = calibrationSide(req.user, req.body.side);
  await assertAgentManager(calibration, side, req.user);
  const mine = side === 'qa' ? 'qaSignOff' : 'managerSignOff';
  const other = side === 'qa' ? 'managerSignOff' : 'qaSignOff';

  if (calibration.agreedScore !== req.body.agreedScore) {
    calibration.agreedScore = req.body.agreedScore;
    calibration[other] = undefined;
  }
  calibration[mine] = { by: req.user._id, at: new Date(), comment: req.body.comment };
  if (calibration.qaSignOff?.by && calibration.managerSignOff?.by) calibration.status = 'agreed';
  await calibration.save();

  const populated = await Calibration.findById(calibration._id).populate(CALIBRATION_POPULATE);
  sendSuccess(res, {
    data: maskCalibration(populated, req.user),
    message: calibration.status === 'agreed' ? 'Calibration agreed by both teams' : 'Sign-off recorded, waiting for the other team',
  });
}
