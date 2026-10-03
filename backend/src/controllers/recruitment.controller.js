import { Application, JobPosting, Settings, User, Warning, generateCode } from '../models/index.js';
import { HR_ROLES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { escapeRegex } from '../utils/pagination.js';
import { emptyToNull, pick } from '../utils/helpers.js';
import { todayInTz } from '../utils/date.js';
import { activeWarningFilter } from '../services/relations.service.js';
import { notify, notifyMany, sendEmail } from '../services/notification.service.js';
import { env } from '../config/env.js';

const STATUS_LABELS = {
  received: 'Application Received',
  'under-review': 'Under Review',
  'interview-scheduled': 'Interview Scheduled',
  selected: 'Selected',
  rejected: 'Rejected',
  'offer-sent': 'Offer Sent',
  onboarding: 'Onboarding',
};
const JOB_FIELDS = ['title', 'department', 'designation', 'location', 'employmentType', 'description', 'requirements', 'openings', 'isInternal', 'minTenureMonths', 'blockOnFinalWarning', 'closingDate', 'status'];
const APP_POPULATE = [
  { path: 'job', select: 'title refNo department location status', populate: { path: 'department', select: 'name' } },
  { path: 'applicant', select: 'firstName lastName email employeeCode avatar designation department' },
  { path: 'interviews.interviewers', select: 'firstName lastName' },
  { path: 'statusHistory.by', select: 'firstName lastName' },
];

const statusPageUrl = (app) => `${env.clientOrigins[0] || ''}/application-status?ref=${app.refNo}`;

// In-app (+ email) for employees, email for external candidates
async function notifyApplicant(app, title, message) {
  if (app.applicant) {
    notify(app.applicant._id || app.applicant, { title, message, link: '/careers', email: true });
  } else if (app.candidate?.email) {
    sendEmail(app.candidate.email, title, `${message}\n\nTrack your application: ${statusPageUrl(app)} (reference ${app.refNo})`);
  }
}

// Can this employee apply for an internal job?
async function checkEligibility(job, user, today) {
  if (job.status !== 'open' || !job.isInternal) return { eligible: false, reason: 'This job is not open for internal applications' };
  if (job.closingDate && job.closingDate < today) return { eligible: false, reason: 'Applications are closed' };
  const tenureMonths = (Date.parse(today) - new Date(user.dateOfJoining).getTime()) / (30.44 * 86400000);
  if (tenureMonths < job.minTenureMonths) {
    return { eligible: false, reason: `Requires at least ${job.minTenureMonths} months in the company` };
  }
  if (job.blockOnFinalWarning && (await Warning.exists({ employee: user._id, stage: { $gte: 3 }, ...activeWarningFilter(today) }))) {
    return { eligible: false, reason: 'Not eligible while a final warning is active' };
  }
  return { eligible: true };
}

/* ------------------------------- HR: jobs ------------------------------- */

// GET /api/recruitment/jobs?status
export async function listJobs(req, res) {
  const filter = req.query.status ? { status: req.query.status } : {};
  const jobs = await JobPosting.find(filter).populate('department', 'name').populate('designation', 'title').sort({ createdAt: -1 });
  const counts = await Application.aggregate([{ $group: { _id: { job: '$job', status: '$status' }, count: { $sum: 1 } } }]);

  const data = jobs.map((job) => {
    const byStatus = {};
    counts.filter((c) => String(c._id.job) === String(job._id)).forEach((c) => (byStatus[c._id.status] = c.count));
    return { ...job.toObject(), applications: { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus } };
  });
  sendSuccess(res, { data });
}

export async function createJob(req, res) {
  const job = await JobPosting.create({
    ...emptyToNull(pick(req.body, JOB_FIELDS), ['department', 'designation']),
    refNo: await generateCode('job', 'JOB'),
    createdBy: req.user._id,
  });
  if (job.status === 'open' && job.isInternal) {
    const everyone = await User.find({ status: 'active' }).distinct('_id');
    notifyMany(everyone, { title: 'New internal opening', message: `${job.title} — apply from Internal Jobs`, link: '/careers' });
  }
  sendSuccess(res, { data: job, message: `Job ${job.refNo} created`, status: 201 });
}

export async function updateJob(req, res) {
  const job = await JobPosting.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');
  job.set(emptyToNull(pick(req.body, JOB_FIELDS), ['department', 'designation']));
  await job.save();
  sendSuccess(res, { data: job, message: 'Job updated' });
}

/* ------------------------------- HR: applications (ATS) ------------------------------- */

// GET /api/recruitment/applications?job&status&search
export async function listApplications(req, res) {
  const filter = {};
  if (req.query.job) filter.job = req.query.job;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), 'i');
    const employees = await User.find({ $or: [{ firstName: regex }, { lastName: regex }, { email: regex }] }).distinct('_id');
    filter.$or = [{ 'candidate.name': regex }, { 'candidate.email': regex }, { refNo: regex }, { applicant: { $in: employees } }];
  }
  const apps = await Application.find(filter).populate(APP_POPULATE).sort({ createdAt: -1 }).limit(500);
  sendSuccess(res, { data: apps });
}

export async function getApplication(req, res) {
  const app = await Application.findById(req.params.id).populate(APP_POPULATE);
  if (!app) throw ApiError.notFound('Application not found');
  sendSuccess(res, { data: app });
}

// POST /api/recruitment/applications - HR adds an external / referral candidate
export async function createApplication(req, res) {
  const job = await JobPosting.findById(req.body.job);
  if (!job) throw ApiError.field('job', 'Job not found');
  if (await Application.exists({ job: job._id, 'candidate.email': req.body.candidate.email })) {
    throw ApiError.field('candidate.email', 'This candidate has already applied for this job');
  }
  const app = await Application.create({
    ...pick(req.body, ['job', 'candidate', 'resumeUrl', 'coverNote', 'source', 'hrNotes']),
    refNo: await generateCode('application', 'APP'),
    statusHistory: [{ status: 'received', by: req.user._id }],
  });
  notifyApplicant(app, `Application received: ${job.title}`, `Thank you for applying for ${job.title}. Your reference number is ${app.refNo}.`);
  sendSuccess(res, { data: app, message: `Candidate added (${app.refNo})`, status: 201 });
}

// PATCH /api/recruitment/applications/:id/status { status, note }
export async function updateApplicationStatus(req, res) {
  const app = await Application.findById(req.params.id).populate('job', 'title');
  if (!app) throw ApiError.notFound('Application not found');
  if (app.status === req.body.status) throw ApiError.badRequest(`Application is already "${STATUS_LABELS[app.status]}"`);

  app.status = req.body.status;
  app.statusHistory.push({ status: req.body.status, note: req.body.note, by: req.user._id });
  await app.save();

  notifyApplicant(app, `Application update: ${STATUS_LABELS[app.status]}`, `Your application for ${app.job.title} is now "${STATUS_LABELS[app.status]}".${req.body.note ? ` ${req.body.note}` : ''}`);
  const populated = await Application.findById(app._id).populate(APP_POPULATE);
  sendSuccess(res, { data: populated, message: `Status changed to ${STATUS_LABELS[app.status]}` });
}

// POST /api/recruitment/applications/:id/interviews
export async function scheduleInterview(req, res) {
  const app = await Application.findById(req.params.id).populate('job', 'title');
  if (!app) throw ApiError.notFound('Application not found');
  if (new Date(req.body.scheduledAt) < new Date()) throw ApiError.field('scheduledAt', 'Interview time must be in the future');

  app.interviews.push(pick(req.body, ['round', 'scheduledAt', 'durationMinutes', 'mode', 'location', 'interviewers']));
  if (['received', 'under-review'].includes(app.status)) {
    app.status = 'interview-scheduled';
    app.statusHistory.push({ status: 'interview-scheduled', note: req.body.round, by: req.user._id });
  }
  await app.save();

  const when = new Date(req.body.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: (await Settings.getSettings()).timezone });
  const where = `${req.body.mode}${req.body.location ? ` — ${req.body.location}` : ''}`;
  notifyApplicant(app, `Interview invitation: ${app.job.title}`, `${req.body.round || 'Interview'} is scheduled on ${when} (${where}).`);
  notifyMany(req.body.interviewers, {
    title: 'You are on an interview panel',
    message: `${req.body.round || 'Interview'} for ${app.job.title} on ${when} (${where})`,
    link: '/careers?tab=interviews',
    email: true,
  });

  const populated = await Application.findById(app._id).populate(APP_POPULATE);
  sendSuccess(res, { data: populated, message: 'Interview scheduled and invitations sent' });
}

async function saveInterviewResult(app, interviewId, body) {
  const interview = app.interviews.id(interviewId);
  if (!interview) throw ApiError.notFound('Interview not found');
  interview.set(pick(body, ['result', 'feedback']));
  await app.save();
  return interview;
}

// PATCH /api/recruitment/applications/:id/interviews/:interviewId { result, feedback }
export async function updateInterview(req, res) {
  const app = await Application.findById(req.params.id);
  if (!app) throw ApiError.notFound('Application not found');
  await saveInterviewResult(app, req.params.interviewId, req.body);
  const populated = await Application.findById(app._id).populate(APP_POPULATE);
  sendSuccess(res, { data: populated, message: 'Interview updated' });
}

// POST /api/recruitment/applications/:id/documents { names: [] } - request documents
export async function requestDocuments(req, res) {
  const app = await Application.findById(req.params.id).populate('job', 'title');
  if (!app) throw ApiError.notFound('Application not found');
  const existing = new Set(app.documents.map((d) => d.name.toLowerCase()));
  const names = req.body.names.filter((n) => !existing.has(n.toLowerCase()));
  if (!names.length) throw ApiError.field('names', 'These documents are already requested');

  names.forEach((name) => app.documents.push({ name, note: req.body.note }));
  await app.save();
  notifyApplicant(app, 'Documents requested', `Please submit: ${names.join(', ')} for your ${app.job.title} application.`);
  const populated = await Application.findById(app._id).populate(APP_POPULATE);
  sendSuccess(res, { data: populated, message: `${names.length} document(s) requested` });
}

// PATCH /api/recruitment/applications/:id/documents/:docId { status, note }
export async function reviewDocument(req, res) {
  const app = await Application.findById(req.params.id).populate('job', 'title');
  if (!app) throw ApiError.notFound('Application not found');
  const doc = app.documents.id(req.params.docId);
  if (!doc) throw ApiError.notFound('Document not found');
  doc.status = req.body.status;
  if (req.body.note !== undefined) doc.note = req.body.note;
  await app.save();
  if (doc.status === 'rejected') notifyApplicant(app, 'Document needs resubmission', `${doc.name}: ${req.body.note || 'please upload it again'}`);
  const populated = await Application.findById(app._id).populate(APP_POPULATE);
  sendSuccess(res, { data: populated, message: `Document marked ${doc.status}` });
}

/* ------------------------------- Employees: internal job posting ------------------------------- */

// GET /api/careers/jobs - open internal vacancies with eligibility
export async function listInternalJobs(req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const jobs = await JobPosting.find({ status: 'open', isInternal: true })
    .populate('department', 'name')
    .populate('designation', 'title')
    .sort({ createdAt: -1 });
  const applied = new Set((await Application.find({ applicant: req.user._id }).distinct('job')).map(String));

  const data = await Promise.all(
    jobs.map(async (job) => ({ ...job.toObject(), hasApplied: applied.has(String(job._id)), ...(await checkEligibility(job, req.user, today)) }))
  );
  sendSuccess(res, { data });
}

// POST /api/careers/jobs/:id/apply { coverNote, resumeUrl }
export async function applyInternal(req, res) {
  const settings = await Settings.getSettings();
  const job = await JobPosting.findById(req.params.id);
  if (!job) throw ApiError.notFound('Job not found');
  const { eligible, reason } = await checkEligibility(job, req.user, todayInTz(settings.timezone));
  if (!eligible) throw ApiError.badRequest(reason);
  if (await Application.exists({ job: job._id, applicant: req.user._id })) throw ApiError.badRequest('You have already applied for this job');

  const app = await Application.create({
    job: job._id,
    applicant: req.user._id,
    source: 'internal',
    ...pick(req.body, ['coverNote', 'resumeUrl']),
    refNo: await generateCode('application', 'APP'),
    statusHistory: [{ status: 'received', by: req.user._id }],
  });
  const hr = await User.find({ role: { $in: HR_ROLES }, status: 'active' }).distinct('_id');
  notifyMany(hr, { title: 'New internal application', message: `${req.user.fullName} applied for ${job.title}`, link: '/recruitment' });
  notify(req.user._id, { title: 'Application received', message: `Your application for ${job.title} (${app.refNo}) was received`, link: '/careers' });
  sendSuccess(res, { data: app, message: 'Application submitted', status: 201 });
}

// Applicant view: no HR notes or interviewer feedback
function applicantView(app) {
  const data = app.toObject();
  delete data.hrNotes;
  data.interviews = data.interviews.map(({ feedback, interviewers, ...rest }) => rest);
  data.statusHistory = data.statusHistory.map(({ status, at }) => ({ status, at, label: STATUS_LABELS[status] }));
  data.statusLabel = STATUS_LABELS[data.status];
  return data;
}

// GET /api/careers/applications - my applications with status
export async function getMyApplications(req, res) {
  const apps = await Application.find({ applicant: req.user._id }).populate(APP_POPULATE).sort({ createdAt: -1 });
  sendSuccess(res, { data: apps.map(applicantView) });
}

// PATCH /api/careers/applications/:id/documents/:docId { url }
export async function submitMyDocument(req, res) {
  const app = await Application.findOne({ _id: req.params.id, applicant: req.user._id });
  if (!app) throw ApiError.notFound('Application not found');
  await submitDocument(app, req.params.docId, req.body.url);
  sendSuccess(res, { data: applicantView(await Application.findById(app._id).populate(APP_POPULATE)), message: 'Document submitted' });
}

async function submitDocument(app, docId, url) {
  const doc = app.documents.id(docId);
  if (!doc) throw ApiError.notFound('Document not found');
  if (doc.status === 'verified') throw ApiError.badRequest('This document is already verified');
  doc.url = url;
  doc.status = 'submitted';
  doc.submittedAt = new Date();
  await app.save();
  const hr = await User.find({ role: { $in: HR_ROLES }, status: 'active' }).distinct('_id');
  notifyMany(hr, { title: 'Document submitted', message: `${doc.name} for application ${app.refNo}`, link: '/recruitment' });
}

// GET /api/careers/interviews - interviews where I am on the panel
export async function getMyPanelInterviews(req, res) {
  const apps = await Application.find({ 'interviews.interviewers': req.user._id }).populate(APP_POPULATE);
  const data = [];
  apps.forEach((app) =>
    app.interviews
      .filter((i) => i.interviewers.some((p) => String(p._id) === String(req.user._id)))
      .forEach((i) =>
        data.push({
          applicationId: app._id,
          refNo: app.refNo,
          job: app.job,
          candidate: app.applicant ? { name: `${app.applicant.firstName} ${app.applicant.lastName}`, email: app.applicant.email } : app.candidate,
          resumeUrl: app.resumeUrl,
          interview: i,
        })
      )
  );
  data.sort((a, b) => new Date(a.interview.scheduledAt) - new Date(b.interview.scheduledAt));
  sendSuccess(res, { data });
}

// PATCH /api/careers/interviews/:id/:interviewId { result, feedback } - panel member records feedback
export async function submitPanelFeedback(req, res) {
  const app = await Application.findById(req.params.id);
  if (!app) throw ApiError.notFound('Application not found');
  const interview = app.interviews.id(req.params.interviewId);
  if (!interview || !interview.interviewers.some((p) => String(p) === String(req.user._id))) throw ApiError.forbidden();
  await saveInterviewResult(app, req.params.interviewId, req.body);
  sendSuccess(res, { message: 'Interview feedback saved' });
}

/* ------------------------------- Public (external candidates) ------------------------------- */

async function findPublicApplication(ref, email) {
  const app = await Application.findOne({ refNo: String(ref || '').toUpperCase(), 'candidate.email': String(email || '').toLowerCase().trim() }).populate(
    'job',
    'title location'
  );
  if (!app) throw ApiError.notFound('No application found for this reference and email');
  return app;
}

// GET /api/public/application-status?ref&email
export async function getPublicStatus(req, res) {
  const app = await findPublicApplication(req.query.ref, req.query.email);
  sendSuccess(res, { data: applicantView(app) });
}

// POST /api/public/applications/:ref/documents/:docId { email, url }
export async function submitPublicDocument(req, res) {
  const app = await findPublicApplication(req.params.ref, req.body.email);
  await submitDocument(app, req.params.docId, req.body.url);
  sendSuccess(res, { data: applicantView(await Application.findById(app._id).populate('job', 'title location')), message: 'Document submitted' });
}
