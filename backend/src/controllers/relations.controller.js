import { ActionPlan, Escalation, QaFeedback, Settings, User, Warning, WarningTrigger, generateCode } from '../models/index.js';
import { HR_ROLES, WARNING_CATEGORIES, WARNING_STAGES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';
import { todayInTz } from '../utils/date.js';
import { canManageEmployee, getScopedUsers, isHR } from '../services/access.service.js';
import { activeWarningFilter, evaluateTriggers, suggestNextStage } from '../services/relations.service.js';
import { notify, notifyMany } from '../services/notification.service.js';

const PERSON = 'firstName lastName employeeCode avatar';
const ESCALATION_POPULATE = [
  { path: 'employee', select: PERSON },
  { path: 'raisedBy', select: 'firstName lastName' },
  { path: 'history.by', select: 'firstName lastName' },
];
const WARNING_POPULATE = [
  { path: 'employee', select: PERSON },
  { path: 'issuedBy', select: 'firstName lastName' },
  { path: 'escalation', select: 'refNo incident' },
  { path: 'history.by', select: 'firstName lastName' },
];

// Adds stageLabel and isActive (not withdrawn / expired) to a warning
function decorateWarning(warning, today) {
  const data = warning.toObject ? warning.toObject() : warning;
  const expired = data.expiresOn && data.expiresOn < today;
  return {
    ...data,
    stageLabel: WARNING_STAGES[data.stage],
    effectiveStatus: expired && ['issued', 'acknowledged'].includes(data.status) ? 'expired' : data.status,
    isActive: ['issued', 'acknowledged'].includes(data.status) && !expired,
  };
}

async function scopedEmployeeFilter(req, field = 'employee') {
  if (req.query.employee) {
    if (!(await canManageEmployee(req.user, req.query.employee))) throw ApiError.forbidden();
    return { [field]: req.query.employee };
  }
  const users = await getScopedUsers(req.user, { managerId: req.query.manager, select: '_id' });
  return { [field]: { $in: users.map((u) => u._id) } };
}

async function hrUserIds() {
  return User.find({ role: { $in: HR_ROLES }, status: 'active' }).distinct('_id');
}

/* ------------------------------- Escalations ------------------------------- */

// POST /api/relations/escalations
export async function createEscalation(req, res) {
  if (!(await canManageEmployee(req.user, req.body.employee))) throw ApiError.forbidden('You can only escalate your own team members');
  const escalation = await Escalation.create({
    ...pick(req.body, ['employee', 'category', 'incident', 'incidentDate', 'evidence', 'expectations', 'followUpDate']),
    refNo: await generateCode('escalation', 'ESC'),
    raisedBy: req.user._id,
    history: [{ action: 'Escalation raised', note: req.body.incident, by: req.user._id }],
  });
  notifyMany(await hrUserIds(), {
    title: 'New employee escalation',
    message: `${escalation.refNo} raised by ${req.user.fullName}`,
    link: '/relations',
  });
  sendSuccess(res, { data: escalation, message: `Escalation ${escalation.refNo} raised`, status: 201 });
}

// GET /api/relations/escalations?employee&status
export async function listEscalations(req, res) {
  const filter = await scopedEmployeeFilter(req);
  if (req.query.status) filter.status = req.query.status;
  const items = await Escalation.find(filter).populate(ESCALATION_POPULATE).sort({ createdAt: -1 }).limit(300);
  sendSuccess(res, { data: items });
}

// PATCH /api/relations/escalations/:id { status, outcome, followUpDate, note }
export async function updateEscalation(req, res) {
  const escalation = await Escalation.findById(req.params.id);
  if (!escalation) throw ApiError.notFound('Escalation not found');
  if (!(await canManageEmployee(req.user, escalation.employee))) throw ApiError.forbidden();

  const changes = [];
  if (req.body.status && req.body.status !== escalation.status) changes.push(`Status: ${escalation.status} → ${req.body.status}`);
  if (req.body.followUpDate && req.body.followUpDate !== escalation.followUpDate) changes.push(`Follow-up set to ${req.body.followUpDate}`);
  if (req.body.outcome && req.body.outcome !== escalation.outcome) changes.push('Outcome recorded');
  escalation.set(pick(req.body, ['status', 'outcome', 'followUpDate']));
  escalation.history.push({ action: changes.join('; ') || 'Note added', note: req.body.note || req.body.outcome, by: req.user._id });
  await escalation.save();

  const populated = await Escalation.findById(escalation._id).populate(ESCALATION_POPULATE);
  sendSuccess(res, { data: populated, message: 'Escalation updated' });
}

/* ------------------------------- Warnings ------------------------------- */

// GET /api/relations/warnings/suggest-stage?employee&category
export async function suggestStage(req, res) {
  if (!(await canManageEmployee(req.user, req.query.employee))) throw ApiError.forbidden();
  if (!WARNING_CATEGORIES.includes(req.query.category)) throw ApiError.field('category', 'Select a category');
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const stage = await suggestNextStage(req.query.employee, req.query.category, today);
  const active = await Warning.find({ employee: req.query.employee, ...activeWarningFilter(today) }).sort({ stage: -1 });
  sendSuccess(res, { data: { stage, label: WARNING_STAGES[stage], active: active.map((w) => decorateWarning(w, today)) } });
}

// POST /api/relations/warnings
export async function issueWarning(req, res) {
  if (!(await canManageEmployee(req.user, req.body.employee))) throw ApiError.forbidden('You can only warn your own team members');
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const suggested = await suggestNextStage(req.body.employee, req.body.category, today);
  const stage = req.body.stage || suggested;

  // Managers follow the stage ladder; HR may skip stages for serious misconduct
  if (stage > suggested && !isHR(req.user)) {
    throw ApiError.field('stage', `The next stage for this category is ${suggested} (${WARNING_STAGES[suggested]}). Only HR can skip stages.`);
  }
  if (stage === 4 && !isHR(req.user)) throw ApiError.field('stage', 'Only HR can move a case to termination review');

  const warning = await Warning.create({
    ...pick(req.body, ['employee', 'category', 'reason', 'details', 'expectations', 'issuedDate', 'expiresOn', 'escalation']),
    stage,
    refNo: await generateCode('warning', 'WRN'),
    issuedBy: req.user._id,
    history: [{ action: `Stage ${stage} – ${WARNING_STAGES[stage]} issued`, note: req.body.reason, by: req.user._id }],
  });

  notify(warning.employee, {
    title: `${WARNING_STAGES[stage]} issued`,
    message: `A ${warning.category} warning (${warning.refNo}) has been issued to you. Please read and acknowledge it.`,
    link: '/my-conduct',
    email: true,
  });
  if (!isHR(req.user)) {
    notifyMany(await hrUserIds(), { title: 'Warning issued', message: `${warning.refNo} (stage ${stage}) by ${req.user.fullName}`, link: '/relations' });
  }
  sendSuccess(res, { data: warning, message: `${WARNING_STAGES[stage]} issued (${warning.refNo})`, status: 201 });
}

// GET /api/relations/warnings?employee&status&category
export async function listWarnings(req, res) {
  const settings = await Settings.getSettings();
  const filter = await scopedEmployeeFilter(req);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  const items = await Warning.find(filter).populate(WARNING_POPULATE).sort({ createdAt: -1 }).limit(300);
  const today = todayInTz(settings.timezone);
  sendSuccess(res, { data: items.map((w) => decorateWarning(w, today)) });
}

// Warnings grouped by category with counts and the highest active stage
function summarizeByCategory(warnings) {
  return WARNING_CATEGORIES.map((category) => {
    const list = warnings.filter((w) => w.category === category);
    const active = list.filter((w) => w.isActive);
    return {
      category,
      total: list.length,
      active: active.length,
      highestStage: active.reduce((max, w) => Math.max(max, w.stage), 0),
    };
  });
}

// GET /api/relations/warnings/my - warnings in the employee's own account, grouped by category
export async function getMyWarnings(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const items = (await Warning.find({ employee: req.user._id }).populate(WARNING_POPULATE).sort({ createdAt: -1 })).map((w) =>
    decorateWarning(w, today)
  );
  sendSuccess(res, {
    data: {
      warnings: items,
      byCategory: summarizeByCategory(items),
      pendingAcknowledgement: items.filter((w) => w.status === 'issued').length,
      stages: WARNING_STAGES,
    },
  });
}

// PATCH /api/relations/warnings/:id/acknowledge { comment } - electronic acknowledgement
export async function acknowledgeWarning(req, res) {
  const warning = await Warning.findOne({ _id: req.params.id, employee: req.user._id });
  if (!warning) throw ApiError.notFound('Warning not found');
  if (warning.status !== 'issued') throw ApiError.badRequest('This warning cannot be acknowledged');

  warning.status = 'acknowledged';
  warning.acknowledgedAt = new Date();
  warning.employeeComment = req.body.comment;
  warning.history.push({ action: 'Acknowledged by employee', note: req.body.comment, by: req.user._id });
  await warning.save();
  notify(warning.issuedBy, { title: 'Warning acknowledged', message: `${req.user.fullName} acknowledged ${warning.refNo}`, link: '/relations' });
  sendSuccess(res, { data: warning, message: 'Warning acknowledged' });
}

// PATCH /api/relations/warnings/:id/withdraw { note }
export async function withdrawWarning(req, res) {
  const warning = await Warning.findById(req.params.id);
  if (!warning) throw ApiError.notFound('Warning not found');
  const isIssuer = String(warning.issuedBy) === String(req.user._id);
  if (!isIssuer && !isHR(req.user)) throw ApiError.forbidden();
  if (warning.status === 'withdrawn') throw ApiError.badRequest('Warning is already withdrawn');

  warning.status = 'withdrawn';
  warning.history.push({ action: 'Warning withdrawn', note: req.body.note, by: req.user._id });
  await warning.save();
  notify(warning.employee, { title: 'Warning withdrawn', message: `${warning.refNo} has been withdrawn`, link: '/my-conduct' });
  sendSuccess(res, { data: warning, message: 'Warning withdrawn' });
}

/* ------------------------------- Triggers ------------------------------- */

export async function listTriggers(_req, res) {
  sendSuccess(res, { data: await WarningTrigger.find().sort({ createdAt: 1 }) });
}

export async function createTrigger(req, res) {
  const trigger = await WarningTrigger.create(req.body);
  sendSuccess(res, { data: trigger, message: 'Trigger created', status: 201 });
}

export async function updateTrigger(req, res) {
  const trigger = await WarningTrigger.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!trigger) throw ApiError.notFound('Trigger not found');
  sendSuccess(res, { data: trigger, message: 'Trigger updated' });
}

export async function deleteTrigger(req, res) {
  const trigger = await WarningTrigger.findByIdAndDelete(req.params.id);
  if (!trigger) throw ApiError.notFound('Trigger not found');
  sendSuccess(res, { message: 'Trigger deleted' });
}

// GET /api/relations/flags?manager - employees flagged by triggers, for manager review
export async function getFlags(req, res) {
  const settings = await Settings.getSettings();
  const users = await getScopedUsers(req.user, { managerId: req.query.manager });
  const flags = await evaluateTriggers(users, settings);
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));
  sendSuccess(res, { data: flags.map((f) => ({ ...f, user: userMap[f.user] })) });
}

/* ------------------------------- History ------------------------------- */

/*
 * GET /api/relations/history/:employeeId
 * Auditable timeline of escalations, warnings, acknowledgements, action plans and outcomes.
 */
export async function getHistory(req, res) {
  const employeeId = req.params.employeeId;
  if (!(await canManageEmployee(req.user, employeeId))) throw ApiError.forbidden();
  const employee = await User.findById(employeeId).select(PERSON);
  if (!employee) throw ApiError.notFound('Employee not found');

  const [escalations, warnings, actionPlans, audits] = await Promise.all([
    Escalation.find({ employee: employeeId }).populate('history.by', 'firstName lastName'),
    Warning.find({ employee: employeeId }).populate('history.by', 'firstName lastName'),
    ActionPlan.find({ user: employeeId }).populate('createdBy', 'firstName lastName'),
    QaFeedback.find({ user: employeeId, $or: [{ isFatal: true }, { acknowledgedAt: { $ne: null } }] }).populate('auditor', 'firstName lastName'),
  ]);

  const events = [];
  escalations.forEach((e) =>
    e.history.forEach((h) => events.push({ type: 'escalation', ref: e.refNo, title: h.action, note: h.note, by: h.by, at: h.at, category: e.category }))
  );
  warnings.forEach((w) =>
    w.history.forEach((h) =>
      events.push({ type: 'warning', ref: w.refNo, title: h.action, note: h.note, by: h.by, at: h.at, category: w.category, stage: w.stage })
    )
  );
  actionPlans.forEach((p) => {
    events.push({ type: 'action-plan', ref: p.title, title: `Action plan created (${p.metric})`, note: p.reason, by: p.createdBy, at: p.createdAt });
    if (p.employeeAcknowledgedAt) events.push({ type: 'action-plan', ref: p.title, title: 'Action plan acknowledged', note: p.employeeComment, at: p.employeeAcknowledgedAt });
    p.checkIns.forEach((c) => events.push({ type: 'action-plan', ref: p.title, title: 'Follow-up', note: c.note, at: c.createdAt }));
    if (['completed', 'closed'].includes(p.status)) events.push({ type: 'action-plan', ref: p.title, title: `Plan ${p.status}`, note: p.outcome, at: p.updatedAt });
  });
  audits.forEach((a) => {
    if (a.isFatal) events.push({ type: 'qa', ref: a.interactionRef, title: 'Fatal QA error recorded', note: a.comments, by: a.auditor, at: a.createdAt });
    if (a.acknowledgedAt) events.push({ type: 'qa', ref: a.interactionRef, title: 'QA feedback acknowledged', note: a.employeeComment, at: a.acknowledgedAt });
  });

  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  sendSuccess(res, { data: { employee, events } });
}
