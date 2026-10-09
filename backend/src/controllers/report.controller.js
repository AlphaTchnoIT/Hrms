import {
  ActionPlan,
  Application,
  Escalation,
  Grievance,
  JobPosting,
  LeaveRequest,
  QaFeedback,
  Settings,
  TestAttempt,
  Ticket,
  TrainingAssignment,
  User,
  Warning,
} from '../models/index.js';
import { HR_ROLES, ROLES, WARNING_STAGES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { addDays, eachDate, isValidDateStr, monthRange, todayInTz } from '../utils/date.js';
import { getAccessRoles, getScopedUsers, isHR } from '../services/access.service.js';
import { currentRange, getKpiTrend, getManagerRatings, getPerformanceSummaries } from '../services/performance.service.js';
import { getAdherenceTrend, getWorkforce } from '../services/workforce.service.js';
import { getQuarterlyLeaveSummary } from '../services/leave.service.js';
import { activeWarningFilter } from '../services/relations.service.js';
import { leaveStatus } from '../services/workforce.service.js';
import { payrollRates } from '../services/payroll.service.js';
import { getPolicies } from '../services/policy.service.js';
import { annualPay, autoEnrolmentStatus, bradfordFactor, genderPayGap, minimumWageCheck, statutoryNoticeWeeks } from '../services/ukCompliance.service.js';

const name = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');
const hours = (minutes) => Math.round(((minutes || 0) / 60) * 10) / 10;
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Reports and who can run them. Managers get their own team's data only.
const REPORTS = {
  employees: { title: 'Employee master', roles: HR_ROLES },
  attendance: { title: 'Attendance & login hours', roles: [...HR_ROLES, ROLES.MANAGER] },
  'leave-quarterly': { title: 'Quarterly leave summary', roles: [...HR_ROLES, ROLES.MANAGER] },
  kpi: { title: 'KPI & performance status', roles: [...HR_ROLES, ROLES.MANAGER] },
  qa: { title: 'QA audits', roles: [...HR_ROLES, ROLES.MANAGER, ROLES.QA] },
  escalations: { title: 'Escalations', roles: [...HR_ROLES, ROLES.MANAGER] },
  warnings: { title: 'Warnings', roles: [...HR_ROLES, ROLES.MANAGER] },
  'action-plans': { title: 'Action plans', roles: [...HR_ROLES, ROLES.MANAGER] },
  training: { title: 'Training & assessments', roles: [...HR_ROLES, ROLES.MANAGER] },
  'manager-ratings': { title: 'Manager ratings (team performance)', roles: HR_ROLES },
  recruitment: { title: 'Recruitment pipeline', roles: HR_ROLES },
  tickets: { title: 'IT tickets', roles: [ROLES.ADMIN, ROLES.IT] },
  bradford: { title: 'Sickness absence (Bradford Factor, last 52 weeks)', roles: [...HR_ROLES, ROLES.MANAGER] },
  'uk-compliance': { title: 'UK compliance (right to work, minimum wage, pension, notice)', roles: HR_ROLES },
  'gender-pay-gap': { title: 'Gender pay gap', roles: HR_ROLES },
};

// GET /api/reports - reports available to the user
export async function listReports(req, res) {
  const data = Object.entries(REPORTS)
    .filter(([, r]) => getAccessRoles(req.user).some((role) => r.roles.includes(role)))
    .map(([key, r]) => ({ key, title: r.title }));
  sendSuccess(res, { data });
}

function readRange(query, settings) {
  const today = todayInTz(settings.timezone);
  const from = isValidDateStr(query.from) ? query.from : addDays(today, -29);
  const to = isValidDateStr(query.to) ? query.to : today;
  if (to < from) throw ApiError.badRequest('"To" date cannot be before "from" date');
  return { from, to };
}

const col = (key, header) => ({ key, header });

/*
 * GET /api/reports/:type?from&to&manager&department&year
 * Returns { title, columns, rows } so the frontend can show a table and export CSV.
 */
export async function runReport(req, res) {
  const report = REPORTS[req.params.type];
  if (!report) throw ApiError.notFound('Unknown report');
  if (!getAccessRoles(req.user).some((role) => report.roles.includes(role))) throw ApiError.forbidden();

  const settings = await Settings.getSettings();
  const range = readRange(req.query, settings);
  let users = await getScopedUsers(req.user, { scope: req.query.scope, managerId: req.query.manager });
  if (req.query.department) users = users.filter((u) => String(u.department) === req.query.department);
  const ids = users.map((u) => u._id);
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));
  let columns = [];
  let rows = [];

  switch (req.params.type) {
    case 'employees': {
      const employees = await User.find(req.query.department ? { department: req.query.department } : {})
        .populate('department', 'name')
        .populate('designation', 'title')
        .populate('reportingManager', 'firstName lastName')
        .sort({ employeeCode: 1 });
      columns = [col('code', 'Code'), col('name', 'Name'), col('email', 'Email'), col('role', 'Role'), col('department', 'Department'), col('designation', 'Designation'), col('manager', 'Manager'), col('joined', 'Joined'), col('type', 'Type'), col('status', 'Status')];
      rows = employees.map((e) => ({
        code: e.employeeCode, name: name(e), email: e.email, role: e.role, department: e.department?.name || '',
        designation: e.designation?.title || '', manager: name(e.reportingManager), joined: dateOnly(e.dateOfJoining),
        type: e.employmentType, status: e.status,
      }));
      break;
    }

    case 'attendance': {
      if (eachDate(range.from, range.to).length > 93) throw ApiError.badRequest('Please select at most 93 days');
      const workforce = await getWorkforce(users, range.from, range.to, settings);
      columns = [col('code', 'Code'), col('name', 'Name'), col('scheduledDays', 'Working days'), col('present', 'Present'), col('absent', 'Absent'), col('lateLogins', 'Late logins'), col('shortLogins', 'Short logins'), col('sickLeave', 'Sick leave'), col('emergencyLeave', 'Emergency leave'), col('approvedLeave', 'Other leave'), col('loginHours', 'Login hrs'), col('scheduledHours', 'Scheduled hrs'), col('productiveHours', 'AT hrs'), col('idleHours', 'Idle hrs'), col('attendancePercent', 'Attendance %'), col('adherencePercent', 'Adherence %')];
      rows = users.map((u) => {
        const s = workforce[String(u._id)].summary;
        return {
          code: u.employeeCode, name: name(u), scheduledDays: s.scheduledDays, present: s.present, absent: s.absent,
          lateLogins: s.lateLogins, shortLogins: s.shortLogins, sickLeave: s.sickLeave, emergencyLeave: s.emergencyLeave,
          approvedLeave: s.approvedLeave, loginHours: hours(s.loginMinutes), scheduledHours: hours(s.scheduledMinutes),
          productiveHours: hours(s.productiveMinutes), idleHours: hours(s.idleMinutes),
          attendancePercent: s.attendancePercent ?? '', adherencePercent: s.adherencePercent ?? '',
        };
      });
      break;
    }

    case 'leave-quarterly': {
      const year = Number(req.query.year) || Number(range.to.slice(0, 4));
      const summary = await getQuarterlyLeaveSummary(ids, year, settings);
      columns = [col('code', 'Code'), col('name', 'Name'), col('leaveType', 'Leave type'), col('q1', 'Q1 (Jan-Mar)'), col('q2', 'Q2 (Apr-Jun)'), col('q3', 'Q3 (Jul-Sep)'), col('q4', 'Q4 (Oct-Dec)'), col('total', `Total ${year}`)];
      users.forEach((u) => {
        const s = summary[String(u._id)];
        s.types.forEach((t) =>
          rows.push({ code: u.employeeCode, name: name(u), leaveType: t.leaveType?.name, q1: t.quarters[0], q2: t.quarters[1], q3: t.quarters[2], q4: t.quarters[3], total: t.total })
        );
        rows.push({ code: u.employeeCode, name: name(u), leaveType: 'All leave', q1: s.quarters[0], q2: s.quarters[1], q3: s.quarters[2], q4: s.quarters[3], total: s.total });
      });
      break;
    }

    case 'kpi': {
      const summaries = await getPerformanceSummaries(users, { ...range, settings });
      columns = [col('code', 'Code'), col('name', 'Name'), col('quality', 'Quality %'), col('efficiency', 'Efficiency %'), col('efficiencyTarget', 'Eff. target'), col('classification', 'Classification %'), col('adherence', 'Adherence %'), col('composite', 'Composite'), col('rating', 'Rating (1-5)'), col('status', 'Status')];
      rows = users.map((u) => {
        const s = summaries[String(u._id)];
        return {
          code: u.employeeCode, name: name(u), quality: s.metrics.quality.score ?? '', efficiency: s.metrics.efficiency.score ?? '',
          efficiencyTarget: s.metrics.efficiency.target, classification: s.metrics.classification.score ?? '',
          adherence: s.metrics.adherence.score ?? '', composite: s.compositeScore ?? '', rating: s.rating ?? '', status: s.status || 'no data',
        };
      });
      break;
    }

    case 'qa': {
      const items = await QaFeedback.find({ user: { $in: ids }, auditDate: { $gte: range.from, $lte: range.to } })
        .populate('auditor', 'firstName lastName')
        .sort({ auditDate: -1 });
      columns = [col('date', 'Audit date'), col('code', 'Code'), col('name', 'Employee'), col('auditor', 'Auditor'), col('ref', 'Interaction'), col('score', 'Score'), col('fatal', 'Fatal'), col('errors', 'Error categories'), col('acknowledged', 'Acknowledged')];
      rows = items.map((f) => ({
        date: f.auditDate, code: userMap[String(f.user)]?.employeeCode, name: name(userMap[String(f.user)]), auditor: name(f.auditor),
        ref: f.interactionRef || '', score: f.score, fatal: f.isFatal ? 'Yes' : 'No', errors: f.errorCategories.join('; '),
        acknowledged: f.acknowledgedAt ? dateOnly(f.acknowledgedAt) : 'Pending',
      }));
      break;
    }

    case 'escalations': {
      const items = await Escalation.find({ employee: { $in: ids }, incidentDate: { $gte: range.from, $lte: range.to } })
        .populate('raisedBy', 'firstName lastName')
        .sort({ incidentDate: -1 });
      columns = [col('ref', 'Ref'), col('date', 'Incident date'), col('name', 'Employee'), col('category', 'Category'), col('incident', 'Incident'), col('raisedBy', 'Raised by'), col('followUp', 'Follow-up'), col('status', 'Status'), col('outcome', 'Outcome')];
      rows = items.map((e) => ({
        ref: e.refNo, date: e.incidentDate, name: name(userMap[String(e.employee)]), category: e.category, incident: e.incident,
        raisedBy: name(e.raisedBy), followUp: e.followUpDate || '', status: e.status, outcome: e.outcome || '',
      }));
      break;
    }

    case 'warnings': {
      const items = await Warning.find({ employee: { $in: ids }, issuedDate: { $gte: range.from, $lte: range.to } })
        .populate('issuedBy', 'firstName lastName')
        .sort({ issuedDate: -1 });
      columns = [col('ref', 'Ref'), col('date', 'Issued'), col('name', 'Employee'), col('category', 'Category'), col('stage', 'Stage'), col('reason', 'Reason'), col('issuedBy', 'Issued by'), col('status', 'Status'), col('acknowledged', 'Acknowledged on'), col('expires', 'Expires')];
      rows = items.map((w) => ({
        ref: w.refNo, date: w.issuedDate, name: name(userMap[String(w.employee)]), category: w.category, stage: `${w.stage} - ${WARNING_STAGES[w.stage]}`,
        reason: w.reason, issuedBy: name(w.issuedBy), status: w.status, acknowledged: dateOnly(w.acknowledgedAt), expires: w.expiresOn || '',
      }));
      break;
    }

    case 'action-plans': {
      const items = await ActionPlan.find({ user: { $in: ids }, startDate: { $lte: range.to }, deadline: { $gte: range.from } }).sort({ startDate: -1 });
      columns = [col('name', 'Employee'), col('metric', 'KPI'), col('title', 'Plan'), col('baseline', 'Baseline'), col('target', 'Target'), col('start', 'Start'), col('deadline', 'Deadline'), col('followUp', 'Next follow-up'), col('actions', 'Actions done'), col('status', 'Status'), col('acknowledged', 'Acknowledged')];
      rows = items.map((p) => ({
        name: name(userMap[String(p.user)]), metric: p.metric, title: p.title, baseline: p.baselineScore ?? '', target: p.targetScore,
        start: p.startDate, deadline: p.deadline, followUp: p.followUpDate || '', actions: `${p.actions.filter((a) => a.isDone).length}/${p.actions.length}`,
        status: p.status, acknowledged: p.employeeAcknowledgedAt ? 'Yes' : 'No',
      }));
      break;
    }

    case 'training': {
      const today = todayInTz(settings.timezone);
      const [assignments, attempts] = await Promise.all([
        TrainingAssignment.find({ user: { $in: ids } }),
        TestAttempt.find({ user: { $in: ids }, submittedAt: { $gte: new Date(range.from), $lte: new Date(`${range.to}T23:59:59Z`) } }),
      ]);
      columns = [col('code', 'Code'), col('name', 'Name'), col('assigned', 'Trainings assigned'), col('completed', 'Completed'), col('overdue', 'Overdue'), col('attempts', 'Test attempts'), col('passed', 'Tests passed'), col('avgScore', 'Avg test %')];
      rows = users.map((u) => {
        const id = String(u._id);
        const mine = assignments.filter((a) => String(a.user) === id);
        const tries = attempts.filter((a) => String(a.user) === id);
        return {
          code: u.employeeCode, name: name(u), assigned: mine.length, completed: mine.filter((a) => a.status === 'completed').length,
          overdue: mine.filter((a) => a.status !== 'completed' && a.dueDate < today).length, attempts: tries.length,
          passed: tries.filter((a) => a.passed).length,
          avgScore: tries.length ? Math.round(tries.reduce((s, a) => s + a.percent, 0) / tries.length) : '',
        };
      });
      break;
    }

    case 'manager-ratings': {
      const ratings = await getManagerRatings(settings);
      columns = [col('name', 'Manager'), col('teamSize', 'Team size'), col('quality', 'Team quality'), col('efficiency', 'Team efficiency'), col('classification', 'Team classification'), col('adherence', 'Team adherence'), col('achievement', 'Achievement'), col('rating', 'Manager rating'), col('critical', 'Critical'), col('attention', 'Needs attention')];
      rows = ratings.map((r) => ({
        name: name(r.manager), teamSize: r.teamSize, quality: r.averages.quality ?? '', efficiency: r.averages.efficiency ?? '',
        classification: r.averages.classification ?? '', adherence: r.averages.adherence ?? '',
        achievement: r.teamAchievement === null ? '' : `${Math.round(r.teamAchievement * 100)}%`, rating: r.rating ?? '',
        critical: r.statusCounts.critical, attention: r.statusCounts['needs-attention'],
      }));
      break;
    }

    case 'recruitment': {
      const apps = await Application.find({ createdAt: { $gte: new Date(range.from), $lte: new Date(`${range.to}T23:59:59Z`) } })
        .populate('job', 'title refNo')
        .populate('applicant', 'firstName lastName email')
        .sort({ createdAt: -1 });
      columns = [col('ref', 'Ref'), col('job', 'Job'), col('candidate', 'Candidate'), col('email', 'Email'), col('source', 'Source'), col('status', 'Status'), col('interviews', 'Interviews'), col('docs', 'Docs pending'), col('applied', 'Applied on')];
      rows = apps.map((a) => ({
        ref: a.refNo, job: a.job?.title, candidate: a.applicant ? name(a.applicant) : a.candidate?.name, email: a.applicant?.email || a.candidate?.email,
        source: a.source, status: a.status, interviews: a.interviews.length, docs: a.documents.filter((d) => d.status === 'requested').length,
        applied: dateOnly(a.createdAt),
      }));
      break;
    }

    case 'tickets': {
      const tickets = await Ticket.find({ createdAt: { $gte: new Date(range.from), $lte: new Date(`${range.to}T23:59:59Z`) } })
        .populate('raisedBy', 'firstName lastName')
        .populate('assignedTo', 'firstName lastName')
        .sort({ createdAt: -1 });
      columns = [col('ticket', 'Ticket'), col('subject', 'Subject'), col('category', 'Category'), col('priority', 'Priority'), col('raisedBy', 'Raised by'), col('assignedTo', 'Assigned to'), col('status', 'Status'), col('created', 'Created'), col('resolved', 'Resolved')];
      rows = tickets.map((t) => ({
        ticket: t.ticketNo, subject: t.subject, category: t.category, priority: t.priority, raisedBy: name(t.raisedBy),
        assignedTo: name(t.assignedTo), status: t.status, created: dateOnly(t.createdAt), resolved: dateOnly(t.resolvedAt),
      }));
      break;
    }

    // Sickness spells and days over the last 52 weeks; Bradford Factor = spells² x days
    case 'bradford': {
      const today = todayInTz(settings.timezone);
      const since = addDays(today, -364);
      const policies = getPolicies(settings);
      const leaves = await LeaveRequest.find({ user: { $in: ids }, status: 'approved', toDate: { $gte: since }, fromDate: { $lte: today } }).populate('leaveType', 'name code');
      const sick = leaves.filter((l) => leaveStatus(l.leaveType) === 'sick-leave' || l.leaveType?.code === 'SSP');
      columns = [col('code', 'Code'), col('name', 'Name'), col('spells', 'Spells'), col('days', 'Days'), col('score', 'Bradford Factor'), col('level', 'Level')];
      rows = users
        .map((u) => {
          const mine = sick.filter((l) => String(l.user) === String(u._id));
          const days = mine.reduce((sum, l) => sum + (l.days || 0), 0);
          const score = bradfordFactor(mine.length, days);
          const level = score >= policies.bradfordFormal ? 'Formal review' : score >= policies.bradfordWarning ? 'Written warning trigger' : score >= policies.bradfordInformal ? 'Informal chat' : 'No concern';
          return { code: u.employeeCode, name: name(u), spells: mine.length, days, score, level };
        })
        .sort((a, b) => b.score - a.score);
      break;
    }

    // One line per active employee with the UK checks HR must keep on top of
    case 'uk-compliance': {
      const rates = payrollRates(settings);
      const today = todayInTz(settings.timezone);
      const people = await User.find({ _id: { $in: ids } }).select(
        'firstName lastName employeeCode dateOfBirth dateOfJoining employmentType salary contractedHoursPerWeek rightToWork probationEndDate noticePeriodWeeks wtrOptOut'
      );
      columns = [col('code', 'Code'), col('name', 'Name'), col('rtw', 'Right to work'), col('rtwExpiry', 'RTW expiry'), col('hourly', 'Hourly pay'), col('minimumWage', 'Minimum wage'), col('pension', 'Pension'), col('probation', 'Probation ends'), col('notice', 'Notice (weeks)'), col('wtr', '48h opt-out'), col('actions', 'Needs action')];
      rows = people.map((p) => {
        const actions = [];
        const rtw = p.rightToWork || {};
        if (!rtw.status || rtw.status === 'not-checked') actions.push('Right to work not checked');
        if (rtw.status === 'time-limited' && rtw.expiryDate && rtw.expiryDate <= addDays(today, getPolicies(settings).rightToWorkFirstReminderDays)) actions.push(rtw.expiryDate < today ? 'Right to work expired' : 'Follow-up RTW check due');
        const wage = minimumWageCheck(p, rates);
        if (wage && !wage.ok) actions.push('Below minimum wage');
        const pension = autoEnrolmentStatus(p, rates);
        const enrolled = p.salary?.pensionEnrolled !== false && !p.salary?.pensionOptedOutOn;
        if (pension === 'eligible' && !enrolled && !p.salary?.pensionOptedOutOn) actions.push('Must be auto-enrolled');
        const statutory = statutoryNoticeWeeks(p.dateOfJoining);
        if (p.noticePeriodWeeks !== undefined && p.noticePeriodWeeks !== null && p.noticePeriodWeeks < statutory) actions.push('Notice below statutory minimum');
        return {
          code: p.employeeCode,
          name: name(p),
          rtw: rtw.status || 'not-checked',
          rtwExpiry: rtw.expiryDate || '',
          hourly: wage ? wage.hourly : '',
          minimumWage: wage ? `${wage.ok ? 'OK' : 'BELOW'} (min ${wage.required})` : '',
          pension: `${pension}${enrolled ? ', enrolled' : p.salary?.pensionOptedOutOn ? ', opted out' : ', not enrolled'}`,
          probation: p.probationEndDate || '',
          notice: `${p.noticePeriodWeeks ?? '—'} (statutory ${statutory})`,
          wtr: p.wtrOptOut ? 'Yes' : 'No',
          actions: actions.join('; ') || 'None',
        };
      });
      break;
    }

    // Equality Act 2010 reporting (mandatory at 250+ employees): hourly pay from contracted hours
    case 'gender-pay-gap': {
      const people = await User.find({ _id: { $in: ids } }).select('gender salary contractedHoursPerWeek');
      const result = genderPayGap(
        people.map((p) => ({
          gender: p.gender,
          hourly: p.salary?.payType === 'hourly' ? p.salary.hourlyRate || 0 : p.contractedHoursPerWeek ? annualPay(p.salary, p.contractedHoursPerWeek) / 52 / p.contractedHoursPerWeek : 0,
        }))
      );
      columns = [col('measure', 'Measure'), col('value', 'Value')];
      rows = result
        ? [
            { measure: 'Men / women included', value: `${result.men} / ${result.women}` },
            { measure: 'Mean gender pay gap (hourly)', value: `${result.meanGap}%` },
            { measure: 'Median gender pay gap (hourly)', value: `${result.medianGap}%` },
            { measure: 'Mean hourly pay (men / women)', value: `${result.meanHourly.men} / ${result.meanHourly.women}` },
            { measure: 'Median hourly pay (men / women)', value: `${result.medianHourly.men} / ${result.medianHourly.women}` },
            ...result.quartiles.map((q) => ({ measure: `${q.quartile} pay quartile: women`, value: `${q.womenPercent}% of ${q.people}` })),
          ]
        : [{ measure: 'Not enough data', value: 'Needs at least one man and one woman with salary and contracted hours' }];
      break;
    }

    default:
      throw ApiError.notFound('Unknown report');
  }

  sendSuccess(res, { data: { title: report.title, range, columns, rows } });
}

/*
 * GET /api/reports/management - organisation level trends (HR / admin)
 *
 * The same for every HR user and heavy to build, so one copy is shared for a minute:
 * many people opening it at once (or refreshing) cost one calculation, not one each.
 */
const MANAGEMENT_CACHE_MS = 60 * 1000;
let managementCache = null; // { promise, at }

export async function getManagementDashboard(req, res) {
  if (!isHR(req.user)) throw ApiError.forbidden();
  const fresh = managementCache && Date.now() - managementCache.at < MANAGEMENT_CACHE_MS;
  if (!fresh || req.query.refresh) {
    const promise = buildManagementDashboard();
    managementCache = { promise, at: Date.now() };
    promise.catch(() => (managementCache = null)); // never keep a failed build
  }
  sendSuccess(res, { data: await managementCache.promise });
}

async function buildManagementDashboard() {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const yearAgo = new Date(`${addDays(today, -365)}T00:00:00Z`);

  const active = await User.find({ status: 'active' }).select('firstName lastName employeeCode avatar department reportingManager dateOfJoining role').populate('department', 'name');
  const [exitsLastYear, joinersLastYear, summaries, adherence, kpiTrend, managerRatings, counts] = await Promise.all([
    User.find({ status: { $ne: 'active' }, exitDate: { $gte: yearAgo } }).select('exitDate'),
    User.countDocuments({ dateOfJoining: { $gte: yearAgo } }),
    getPerformanceSummaries(active, { ...currentRange(settings), settings }),
    getAdherenceTrend(active, settings, 6),
    getKpiTrend(active.map((u) => u._id), settings, 13),
    getManagerRatings(settings),
    Promise.all([
      Escalation.countDocuments({ status: { $in: ['open', 'under-review'] } }),
      Warning.countDocuments(activeWarningFilter(today)),
      Ticket.countDocuments({ status: { $in: ['open', 'in-progress', 'waiting-on-user'] } }),
      Grievance.countDocuments({ status: { $in: ['submitted', 'under-review'] } }),
      JobPosting.countDocuments({ status: 'open' }),
      ActionPlan.countDocuments({ status: { $in: ['open', 'in-progress'] } }),
    ]),
  ]);

  // Monthly exits for the attrition trend (last 6 months)
  const [year, month] = today.split('-').map(Number);
  const attritionTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 6 + i, 1));
    const { start, end } = monthRange(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const exits = exitsLastYear.filter((u) => dateOnly(u.exitDate) >= start && dateOnly(u.exitDate) <= end).length;
    return { month: start.slice(0, 7), exits, rate: active.length ? Math.round((exits / (active.length + exits)) * 1000) / 10 : 0 };
  });

  const rows = active.map((u) => ({ user: u, ...summaries[String(u._id)] }));
  const withData = rows.filter((r) => r.status);
  const statusCounts = { 'meeting-target': 0, 'needs-attention': 0, critical: 0, 'no-data': 0 };
  rows.forEach((r) => (statusCounts[r.status || 'no-data'] += 1));
  const avg = (metric) => {
    const list = rows.map((r) => r.metrics[metric].score).filter((s) => s !== null);
    return list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : null;
  };

  // Department breakdown
  const departments = {};
  rows.forEach((r) => {
    const key = r.user.department?.name || 'Unassigned';
    departments[key] = departments[key] || { name: key, headcount: 0, critical: 0, attention: 0, compositeSum: 0, compositeCount: 0 };
    const d = departments[key];
    d.headcount += 1;
    if (r.status === 'critical') d.critical += 1;
    if (r.status === 'needs-attention') d.attention += 1;
    if (r.compositeScore !== null) {
      d.compositeSum += r.compositeScore;
      d.compositeCount += 1;
    }
  });

  return {
    generatedAt: new Date().toISOString(),
    today,
    headcount: active.length,
    joinersLastYear,
    exitsLastYear: exitsLastYear.length,
    attritionRate: active.length ? Math.round((exitsLastYear.length / (active.length + exitsLastYear.length / 2)) * 1000) / 10 : 0,
    attritionTrend,
    attendanceTrend: adherence.all,
    kpiTrend,
    kpiAchievementPercent: withData.length ? Math.round((statusCounts['meeting-target'] / withData.length) * 1000) / 10 : null,
    statusCounts,
    averages: { quality: avg('quality'), efficiency: avg('efficiency'), classification: avg('classification'), adherence: avg('adherence') },
    targets: settings.toObject().kpiTargets,
    teams: managerRatings,
    teamsRequiringAttention: managerRatings.filter((t) => t.needsAttention || (t.rating !== null && t.rating <= 2)),
    departments: Object.values(departments).map((d) => ({
      name: d.name,
      headcount: d.headcount,
      critical: d.critical,
      attention: d.attention,
      composite: d.compositeCount ? Math.round((d.compositeSum / d.compositeCount) * 10) / 10 : null,
    })),
    open: {
      escalations: counts[0],
      activeWarnings: counts[1],
      tickets: counts[2],
      grievances: counts[3],
      jobs: counts[4],
      actionPlans: counts[5],
    },
  };
}
