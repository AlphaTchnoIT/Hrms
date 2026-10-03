import { Grievance, Suggestion, Ticket, User, generateCode } from '../models/index.js';
import { HR_ROLES, IT_ROLES, ROLES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';
import { isHR } from '../services/access.service.js';
import { notify, notifyMany } from '../services/notification.service.js';

const isIT = (user) => IT_ROLES.includes(user.role);
const TICKET_POPULATE = [
  { path: 'raisedBy', select: 'firstName lastName employeeCode avatar email' },
  { path: 'assignedTo', select: 'firstName lastName' },
  { path: 'comments.by', select: 'firstName lastName role' },
];

const roleUserIds = (roles) => User.find({ role: { $in: roles }, status: 'active' }).distinct('_id');

/* ------------------------------- IT tickets ------------------------------- */

// Requesters don't see IT's internal notes
function ticketView(ticket, user) {
  const data = ticket.toObject();
  if (!isIT(user)) data.comments = data.comments.filter((c) => !c.isInternal);
  return data;
}

// POST /api/support/tickets
export async function createTicket(req, res) {
  const ticket = await Ticket.create({
    ...pick(req.body, ['category', 'priority', 'subject', 'description', 'assetTag']),
    ticketNo: await generateCode('ticket', 'TKT'),
    raisedBy: req.user._id,
  });
  notifyMany(await roleUserIds(IT_ROLES), {
    title: `New ${ticket.priority} priority IT ticket`,
    message: `${ticket.ticketNo}: ${ticket.subject}`,
    link: `/helpdesk?ticket=${ticket._id}`,
  });
  sendSuccess(res, { data: ticket, message: `Ticket ${ticket.ticketNo} raised`, status: 201 });
}

// GET /api/support/tickets?status&scope=mine|all
export async function listTickets(req, res) {
  const filter = {};
  if (!isIT(req.user) || req.query.scope === 'mine') filter.raisedBy = req.user._id;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  const tickets = await Ticket.find(filter).populate(TICKET_POPULATE).sort({ updatedAt: -1 }).limit(300);
  sendSuccess(res, { data: tickets.map((t) => ticketView(t, req.user)) });
}

async function loadTicket(req) {
  const ticket = await Ticket.findById(req.params.id).populate(TICKET_POPULATE);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  const isOwner = String(ticket.raisedBy._id) === String(req.user._id);
  if (!isOwner && !isIT(req.user)) throw ApiError.forbidden();
  return { ticket, isOwner };
}

export async function getTicket(req, res) {
  const { ticket } = await loadTicket(req);
  sendSuccess(res, { data: ticketView(ticket, req.user) });
}

// POST /api/support/tickets/:id/comments { message, isInternal }
export async function addTicketComment(req, res) {
  const { ticket, isOwner } = await loadTicket(req);
  if (['closed'].includes(ticket.status)) throw ApiError.badRequest('This ticket is closed');
  const isInternal = isIT(req.user) && Boolean(req.body.isInternal);
  ticket.comments.push({ by: req.user._id, message: req.body.message, isInternal });
  // Requester replying to "waiting on user" moves it back to IT
  if (isOwner && ticket.status === 'waiting-on-user') ticket.status = 'in-progress';
  await ticket.save();

  if (!isInternal) {
    if (isOwner) {
      notifyMany(ticket.assignedTo ? [ticket.assignedTo._id] : await roleUserIds(IT_ROLES), {
        title: `Reply on ${ticket.ticketNo}`,
        message: req.body.message.slice(0, 120),
        link: `/helpdesk?ticket=${ticket._id}`,
      });
    } else {
      notify(ticket.raisedBy._id, { title: `IT replied on ${ticket.ticketNo}`, message: req.body.message.slice(0, 120), link: `/helpdesk?ticket=${ticket._id}` });
    }
  }
  const populated = await Ticket.findById(ticket._id).populate(TICKET_POPULATE);
  sendSuccess(res, { data: ticketView(populated, req.user), message: 'Comment added' });
}

// PATCH /api/support/tickets/:id { status, priority, assignedTo, resolution } (IT)
export async function updateTicket(req, res) {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) throw ApiError.notFound('Ticket not found');
  const before = ticket.status;
  ticket.set(pick(req.body, ['status', 'priority', 'assignedTo', 'resolution']));
  if (['resolved', 'closed'].includes(ticket.status) && !ticket.resolvedAt) ticket.resolvedAt = new Date();
  if (ticket.status === 'resolved' && !ticket.resolution) throw ApiError.field('resolution', 'Please describe how the issue was resolved');
  await ticket.save();

  if (before !== ticket.status) {
    notify(ticket.raisedBy, {
      title: `${ticket.ticketNo} is now ${ticket.status.replace(/-/g, ' ')}`,
      message: ticket.resolution || ticket.subject,
      link: `/helpdesk?ticket=${ticket._id}`,
    });
  }
  const populated = await Ticket.findById(ticket._id).populate(TICKET_POPULATE);
  sendSuccess(res, { data: ticketView(populated, req.user), message: 'Ticket updated' });
}

// PATCH /api/support/tickets/:id/close - requester confirms the fix (or reopens)
export async function closeOrReopenTicket(req, res) {
  const { ticket, isOwner } = await loadTicket(req);
  if (!isOwner) throw ApiError.forbidden();
  if (req.body.reopen) {
    if (!['resolved', 'closed'].includes(ticket.status)) throw ApiError.badRequest('Only resolved tickets can be reopened');
    ticket.status = 'open';
    ticket.resolvedAt = null;
    ticket.comments.push({ by: req.user._id, message: req.body.message || 'Issue is not fixed, reopening' });
  } else {
    ticket.status = 'closed';
  }
  await ticket.save();
  sendSuccess(res, { data: ticketView(ticket, req.user), message: req.body.reopen ? 'Ticket reopened' : 'Ticket closed' });
}

/* ------------------------------- Grievances (confidential) ------------------------------- */

// Anonymous grievances never reveal the submitter to HR
function grievanceView(grievance, user) {
  const data = grievance.toObject();
  const submitterId = String(grievance.submittedBy?._id || grievance.submittedBy);
  const isOwner = submitterId === String(user._id);
  if (data.isAnonymous && !isOwner) {
    data.submittedBy = null;
    // The submitter's own replies must not reveal who they are either
    data.responses = data.responses.map((r) => (String(r.by?._id || r.by) === submitterId ? { ...r, by: null, fromEmployee: true } : r));
  }
  data.isOwner = isOwner;
  return data;
}

const GRIEVANCE_POPULATE = [
  { path: 'submittedBy', select: 'firstName lastName employeeCode avatar' },
  { path: 'responses.by', select: 'firstName lastName role' },
  { path: 'handledBy', select: 'firstName lastName' },
];

export async function createGrievance(req, res) {
  const grievance = await Grievance.create({
    ...pick(req.body, ['category', 'subject', 'description', 'isAnonymous']),
    refNo: await generateCode('grievance', 'GRV'),
    submittedBy: req.user._id,
  });
  notifyMany(await roleUserIds(HR_ROLES), {
    title: 'New confidential grievance',
    message: `${grievance.refNo} (${grievance.category})`,
    link: '/support?tab=grievances',
  });
  sendSuccess(res, { data: grievance, message: `Grievance ${grievance.refNo} submitted confidentially`, status: 201 });
}

// GET /api/support/grievances?scope=mine|all&status  (only HR sees others' grievances)
export async function listGrievances(req, res) {
  const filter = {};
  if (!isHR(req.user) || req.query.scope === 'mine') filter.submittedBy = req.user._id;
  if (req.query.status) filter.status = req.query.status;
  const items = await Grievance.find(filter).populate(GRIEVANCE_POPULATE).sort({ updatedAt: -1 }).limit(300);
  sendSuccess(res, { data: items.map((g) => grievanceView(g, req.user)) });
}

async function loadGrievance(req) {
  const grievance = await Grievance.findById(req.params.id).populate(GRIEVANCE_POPULATE);
  if (!grievance) throw ApiError.notFound('Grievance not found');
  const isOwner = String(grievance.submittedBy._id) === String(req.user._id);
  if (!isOwner && !isHR(req.user)) throw ApiError.forbidden();
  return { grievance, isOwner };
}

// POST /api/support/grievances/:id/responses { message }
export async function respondGrievance(req, res) {
  const { grievance, isOwner } = await loadGrievance(req);
  if (grievance.status === 'closed') throw ApiError.badRequest('This grievance is closed');
  grievance.responses.push({ by: req.user._id, message: req.body.message });
  if (!isOwner && grievance.status === 'submitted') {
    grievance.status = 'under-review';
    grievance.handledBy = req.user._id;
  }
  await grievance.save();

  if (isOwner) {
    notifyMany(grievance.handledBy ? [grievance.handledBy._id || grievance.handledBy] : await roleUserIds(HR_ROLES), {
      title: `Update on grievance ${grievance.refNo}`,
      message: 'The employee added a message',
      link: '/support?tab=grievances',
    });
  } else {
    notify(grievance.submittedBy._id, { title: `HR responded to ${grievance.refNo}`, message: req.body.message.slice(0, 120), link: '/support?tab=grievances' });
  }
  const populated = await Grievance.findById(grievance._id).populate(GRIEVANCE_POPULATE);
  sendSuccess(res, { data: grievanceView(populated, req.user), message: 'Message sent' });
}

// PATCH /api/support/grievances/:id { status, resolution } (HR)
export async function updateGrievance(req, res) {
  const grievance = await Grievance.findById(req.params.id);
  if (!grievance) throw ApiError.notFound('Grievance not found');
  grievance.set(pick(req.body, ['status', 'resolution']));
  grievance.handledBy = grievance.handledBy || req.user._id;
  if (grievance.status === 'resolved' && !grievance.resolution) throw ApiError.field('resolution', 'Please describe the resolution');
  await grievance.save();
  notify(grievance.submittedBy, { title: `Grievance ${grievance.refNo}: ${grievance.status.replace('-', ' ')}`, message: grievance.resolution, link: '/support?tab=grievances' });
  const populated = await Grievance.findById(grievance._id).populate(GRIEVANCE_POPULATE);
  sendSuccess(res, { data: grievanceView(populated, req.user), message: 'Grievance updated' });
}

/* ------------------------------- Feedback & suggestions ------------------------------- */

const canReviewSuggestions = (user) => [ROLES.ADMIN, ROLES.HR].includes(user.role);

export async function createSuggestion(req, res) {
  const suggestion = await Suggestion.create({ ...pick(req.body, ['type', 'title', 'description']), submittedBy: req.user._id });
  notifyMany(await roleUserIds(HR_ROLES), { title: `New ${suggestion.type}`, message: suggestion.title, link: '/support?tab=suggestions' });
  sendSuccess(res, { data: suggestion, message: 'Thank you! Your submission was sent to management', status: 201 });
}

// GET /api/support/suggestions?scope=mine|all&status
export async function listSuggestions(req, res) {
  const filter = {};
  if (!canReviewSuggestions(req.user) || req.query.scope === 'mine') filter.submittedBy = req.user._id;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;
  const items = await Suggestion.find(filter)
    .populate('submittedBy', 'firstName lastName employeeCode avatar')
    .populate('respondedBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(300);
  sendSuccess(res, { data: items });
}

// PATCH /api/support/suggestions/:id { status, response } (HR / admin)
export async function respondSuggestion(req, res) {
  const suggestion = await Suggestion.findById(req.params.id);
  if (!suggestion) throw ApiError.notFound('Not found');
  suggestion.set(pick(req.body, ['status', 'response']));
  suggestion.respondedBy = req.user._id;
  await suggestion.save();
  notify(suggestion.submittedBy, {
    title: `Your ${suggestion.type} is ${suggestion.status.replace('-', ' ')}`,
    message: suggestion.response || suggestion.title,
    link: '/support?tab=suggestions',
  });
  sendSuccess(res, { data: suggestion, message: 'Response saved' });
}
