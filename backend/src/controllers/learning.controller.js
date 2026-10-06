import { KnowledgeTest, Settings, TestAttempt, TrainingAssignment, TrainingProgram, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { pick } from '../utils/helpers.js';
import { todayInTz } from '../utils/date.js';
import { canAuditEmployee, getScopedUsers, isHR } from '../services/access.service.js';
import { notifyMany } from '../services/notification.service.js';
import { runReminders } from '../services/reminder.service.js';

const PROGRAM_FIELDS = ['title', 'description', 'category', 'durationHours', 'contentUrl', 'completionCriteria', 'isActive'];
const TEST_FIELDS = ['title', 'description', 'questions', 'passPercent', 'maxAttempts', 'timeLimitMinutes', 'showAnswers', 'availableFrom', 'dueDate', 'assignedTo', 'isPublished'];
const ASSIGNMENT_POPULATE = [
  { path: 'program', select: 'title description category durationHours contentUrl completionCriteria' },
  { path: 'user', select: 'firstName lastName employeeCode avatar' },
  { path: 'assignedBy', select: 'firstName lastName' },
];

// Tests the user can see: published, available now, and assigned to everyone or to them
function visibleTestsFilter(userId, today) {
  return {
    isPublished: true,
    $and: [
      { $or: [{ assignedTo: { $size: 0 } }, { assignedTo: userId }] },
      { $or: [{ availableFrom: null }, { availableFrom: { $exists: false } }, { availableFrom: { $lte: today } }] },
    ],
  };
}

/*
 * May the test taker see the correct answers?
 * 'after-submit': always; 'after-final': once they passed or used every attempt; 'never': no.
 */
function answersVisibleToTaker(test, attempts) {
  if (test.showAnswers === 'after-submit') return true;
  if (test.showAnswers === 'never') return false;
  return attempts.some((a) => a.passed) || attempts.length >= test.maxAttempts;
}

// Question-by-question report card of one attempt; correct answers only when allowed
function buildReportCard(test, attempt, { showAnswers }) {
  const questions = test.questions.map((q, i) => {
    const chosen = attempt.answers[i] ?? -1;
    const correct = chosen === q.correctIndex;
    return {
      _id: q._id,
      text: q.text,
      options: q.options,
      marks: q.marks,
      chosenIndex: chosen,
      correct,
      marksScored: correct ? q.marks : 0,
      correctIndex: showAnswers ? q.correctIndex : undefined,
      explanation: showAnswers ? q.explanation : undefined,
    };
  });
  return {
    attemptId: attempt._id,
    test: { _id: test._id, title: test.title, description: test.description, passPercent: test.passPercent, maxAttempts: test.maxAttempts },
    attemptNo: attempt.attemptNo,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percent: attempt.percent,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
    correctCount: questions.filter((q) => q.correct).length,
    answersVisible: showAnswers,
    questions,
  };
}

/* ------------------------------- Programs & assignments ------------------------------- */

export async function listPrograms(_req, res) {
  const programs = await TrainingProgram.find().populate('createdBy', 'firstName lastName').sort({ createdAt: -1 });
  const counts = await TrainingAssignment.aggregate([
    { $group: { _id: '$program', assigned: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
  ]);
  const map = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  sendSuccess(res, { data: programs.map((p) => ({ ...p.toObject(), assigned: map[String(p._id)]?.assigned || 0, completed: map[String(p._id)]?.completed || 0 })) });
}

export async function createProgram(req, res) {
  const program = await TrainingProgram.create({ ...pick(req.body, PROGRAM_FIELDS), createdBy: req.user._id });
  sendSuccess(res, { data: program, message: 'Training programme created', status: 201 });
}

export async function updateProgram(req, res) {
  const program = await TrainingProgram.findByIdAndUpdate(req.params.id, pick(req.body, PROGRAM_FIELDS), { new: true, runValidators: true });
  if (!program) throw ApiError.notFound('Programme not found');
  sendSuccess(res, { data: program, message: 'Training programme updated' });
}

// POST /api/learning/assignments { program, users: [], dueDate }
export async function assignTraining(req, res) {
  const program = await TrainingProgram.findById(req.body.program);
  if (!program || !program.isActive) throw ApiError.field('program', 'Select an active programme');
  for (const userId of req.body.users) {
    if (!(await canAuditEmployee(req.user, userId))) throw ApiError.forbidden('You can only assign training to your own team');
  }

  let created = 0;
  for (const user of req.body.users) {
    const result = await TrainingAssignment.updateOne(
      { program: program._id, user },
      { $setOnInsert: { assignedBy: req.user._id, status: 'assigned', progress: 0 }, $set: { dueDate: req.body.dueDate } },
      { upsert: true }
    );
    if (result.upsertedCount) created += 1;
  }
  notifyMany(req.body.users, { title: 'Training assigned', message: `"${program.title}" — complete by ${req.body.dueDate}`, link: '/learning' });
  sendSuccess(res, { message: `Assigned to ${created} new employee(s)${created < req.body.users.length ? '; due date updated for existing ones' : ''}` });
}

// GET /api/learning/assignments?program&user&status
export async function listAssignments(req, res) {
  const users = await getScopedUsers(req.user, { scope: req.query.scope, select: '_id' });
  const filter = { user: { $in: users.map((u) => u._id) } };
  if (req.query.user) {
    if (!(await canAuditEmployee(req.user, req.query.user))) throw ApiError.forbidden();
    filter.user = req.query.user;
  }
  if (req.query.program) filter.program = req.query.program;
  if (req.query.status) filter.status = req.query.status;
  const items = await TrainingAssignment.find(filter).populate(ASSIGNMENT_POPULATE).sort({ dueDate: 1 }).limit(500);
  sendSuccess(res, { data: items });
}

// PATCH /api/learning/assignments/:id/progress { progress } (employee)
export async function updateMyProgress(req, res) {
  const assignment = await TrainingAssignment.findOne({ _id: req.params.id, user: req.user._id });
  if (!assignment) throw ApiError.notFound('Training not found');
  if (assignment.status === 'completed') throw ApiError.badRequest('This training is already completed');
  assignment.progress = req.body.progress;
  assignment.status = req.body.progress >= 100 ? 'completed' : req.body.progress > 0 ? 'in-progress' : 'assigned';
  if (assignment.status === 'completed') assignment.completedAt = new Date();
  await assignment.save();
  sendSuccess(res, { data: assignment, message: assignment.status === 'completed' ? 'Training completed 🎉' : 'Progress saved' });
}

/* ------------------------------- Knowledge tests ------------------------------- */

// GET /api/learning/tests - tests the user created (HR sees all) with result stats
export async function listTests(req, res) {
  const filter = isHR(req.user) ? {} : { createdBy: req.user._id };
  const tests = await KnowledgeTest.find(filter).populate('createdBy', 'firstName lastName').populate('assignedTo', 'firstName lastName').sort({ createdAt: -1 });
  const stats = await TestAttempt.aggregate([
    { $match: { test: { $in: tests.map((t) => t._id) } } },
    { $group: { _id: '$test', attempts: { $sum: 1 }, takers: { $addToSet: '$user' }, avg: { $avg: '$percent' }, passed: { $sum: { $cond: ['$passed', 1, 0] } } } },
  ]);
  const map = Object.fromEntries(stats.map((s) => [String(s._id), s]));
  sendSuccess(res, {
    data: tests.map((t) => {
      const s = map[String(t._id)];
      return { ...t.toObject(), stats: { attempts: s?.attempts || 0, takers: s?.takers.length || 0, averagePercent: s ? Math.round(s.avg) : null, passed: s?.passed || 0 } };
    }),
  });
}

export async function createTest(req, res) {
  const test = await KnowledgeTest.create({ ...pick(req.body, TEST_FIELDS), createdBy: req.user._id });
  const audience = test.assignedTo.length ? test.assignedTo : await User.find({ status: 'active' }).distinct('_id');
  if (test.isPublished) {
    notifyMany(audience, { title: 'New knowledge test', message: `"${test.title}"${test.dueDate ? ` — due ${test.dueDate}` : ''}`, link: '/learning?tab=tests' });
  }
  sendSuccess(res, { data: test, message: 'Knowledge test created', status: 201 });
}

export async function updateTest(req, res) {
  const test = await KnowledgeTest.findById(req.params.id);
  if (!test) throw ApiError.notFound('Test not found');
  if (!isHR(req.user) && String(test.createdBy) !== String(req.user._id)) throw ApiError.forbidden();
  if (req.body.questions && (await TestAttempt.exists({ test: test._id }))) {
    throw ApiError.field('questions', 'Questions cannot be changed after employees have taken the test');
  }
  test.set(pick(req.body, TEST_FIELDS));
  await test.save();
  sendSuccess(res, { data: test, message: 'Test updated' });
}

async function loadTakeableTest(req) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const test = await KnowledgeTest.findOne({ _id: req.params.id, ...visibleTestsFilter(req.user._id, today) });
  if (!test) throw ApiError.notFound('Test not available');
  const attempts = await TestAttempt.countDocuments({ test: test._id, user: req.user._id });
  return { test, attempts };
}

// GET /api/learning/tests/:id/take - questions without answers
export async function getTestForTaking(req, res) {
  const { test, attempts } = await loadTakeableTest(req);
  if (attempts >= test.maxAttempts) throw ApiError.badRequest('You have used all attempts for this test');
  sendSuccess(res, {
    data: {
      _id: test._id,
      title: test.title,
      description: test.description,
      passPercent: test.passPercent,
      timeLimitMinutes: test.timeLimitMinutes,
      attemptNo: attempts + 1,
      maxAttempts: test.maxAttempts,
      questions: test.questions.map((q) => ({ _id: q._id, text: q.text, options: q.options, marks: q.marks })),
    },
  });
}

// POST /api/learning/tests/:id/attempts { answers: [optionIndex] }
export async function submitAttempt(req, res) {
  const { test, attempts } = await loadTakeableTest(req);
  if (attempts >= test.maxAttempts) throw ApiError.badRequest('You have used all attempts for this test');
  if (req.body.answers.length !== test.questions.length) throw ApiError.field('answers', 'Please answer every question');

  let score = 0;
  let totalMarks = 0;
  const review = test.questions.map((q, i) => {
    totalMarks += q.marks;
    const correct = req.body.answers[i] === q.correctIndex;
    if (correct) score += q.marks;
    return { questionId: q._id, correct };
  });
  const percent = totalMarks ? Math.round((score / totalMarks) * 100) : 0;
  const previous = await TestAttempt.find({ test: test._id, user: req.user._id }).select('passed');
  const attempt = await TestAttempt.create({
    test: test._id,
    user: req.user._id,
    attemptNo: attempts + 1,
    answers: req.body.answers,
    score,
    totalMarks,
    percent,
    passed: percent >= test.passPercent,
  });

  const showAnswers = answersVisibleToTaker(test, [...previous, attempt]);
  sendSuccess(res, {
    data: { attempt, review, attemptsLeft: test.maxAttempts - attempt.attemptNo, reportCard: buildReportCard(test, attempt, { showAnswers }) },
    message: attempt.passed ? `Passed with ${percent}%` : `Scored ${percent}% (pass mark ${test.passPercent}%)`,
    status: 201,
  });
}

/*
 * GET /api/learning/attempts/:id - report card of one attempt
 * The taker sees answers per the test's rule; the test creator, HR and the taker's managers always do.
 */
export async function getAttemptReport(req, res) {
  const attempt = await TestAttempt.findById(req.params.id).populate('user', 'firstName lastName employeeCode avatar');
  if (!attempt) throw ApiError.notFound('Attempt not found');
  const test = await KnowledgeTest.findById(attempt.test);
  if (!test) throw ApiError.notFound('This test no longer exists');

  const isTaker = String(attempt.user._id) === String(req.user._id);
  const isReviewer = isHR(req.user) || String(test.createdBy) === String(req.user._id) || (await canAuditEmployee(req.user, attempt.user._id));
  if (!isTaker && !isReviewer) throw ApiError.forbidden();

  let showAnswers = isReviewer;
  if (!showAnswers) {
    const mine = await TestAttempt.find({ test: test._id, user: attempt.user._id }).select('passed');
    showAnswers = answersVisibleToTaker(test, mine);
  }
  sendSuccess(res, { data: { user: attempt.user, ...buildReportCard(test, attempt, { showAnswers }) } });
}

// GET /api/learning/tests/:id/results
export async function getTestResults(req, res) {
  const test = await KnowledgeTest.findById(req.params.id);
  if (!test) throw ApiError.notFound('Test not found');
  if (!isHR(req.user) && String(test.createdBy) !== String(req.user._id)) throw ApiError.forbidden();
  const attempts = await TestAttempt.find({ test: test._id }).populate('user', 'firstName lastName employeeCode avatar').sort({ submittedAt: -1 });
  sendSuccess(res, { data: { test, attempts } });
}

/* ------------------------------- My learning & records ------------------------------- */

async function buildRecords(userId, today) {
  const [assignments, attempts] = await Promise.all([
    TrainingAssignment.find({ user: userId }).populate(ASSIGNMENT_POPULATE).sort({ dueDate: 1 }),
    TestAttempt.find({ user: userId }).populate('test', 'title passPercent').sort({ submittedAt: -1 }),
  ]);
  // Tests open to them now + every test they already took (even if unpublished or reassigned later)
  const takenIds = [...new Set(attempts.filter((a) => a.test).map((a) => String(a.test._id)))];
  const tests = await KnowledgeTest.find({ $or: [visibleTestsFilter(userId, today), { _id: { $in: takenIds } }] })
    .select('-questions.correctIndex -questions.explanation')
    .sort({ dueDate: 1, createdAt: -1 });

  const testsWithStatus = tests.map((t) => {
    const mine = attempts.filter((a) => String(a.test?._id) === String(t._id));
    const best = mine.reduce((max, a) => Math.max(max, a.percent), -1);
    const passed = mine.some((a) => a.passed);
    const open = t.isPublished && (!t.availableFrom || t.availableFrom <= today) && (!t.assignedTo.length || t.assignedTo.some((id) => String(id) === String(userId)));
    let status = 'pending';
    if (passed) status = 'passed';
    else if (mine.length >= t.maxAttempts) status = 'failed';
    else if (!open) status = 'closed';
    else if (t.dueDate && t.dueDate < today) status = 'overdue';
    return {
      _id: t._id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      passPercent: t.passPercent,
      maxAttempts: t.maxAttempts,
      questionCount: t.questions.length,
      timeLimitMinutes: t.timeLimitMinutes,
      attemptsUsed: mine.length,
      bestPercent: best >= 0 ? best : null,
      status,
      showAnswers: t.showAnswers,
      answersVisible: answersVisibleToTaker(t, mine),
      attempts: mine.map((a) => ({ _id: a._id, attemptNo: a.attemptNo, percent: a.percent, score: a.score, totalMarks: a.totalMarks, passed: a.passed, submittedAt: a.submittedAt })),
    };
  });

  const decorated = assignments.map((a) => ({ ...a.toObject(), isOverdue: a.status !== 'completed' && a.dueDate < today }));
  return {
    assignments: decorated,
    tests: testsWithStatus,
    attempts,
    summary: {
      trainingsAssigned: decorated.length,
      trainingsCompleted: decorated.filter((a) => a.status === 'completed').length,
      trainingsOverdue: decorated.filter((a) => a.isOverdue).length,
      testsPending: testsWithStatus.filter((t) => ['pending', 'overdue'].includes(t.status)).length,
      testsPassed: testsWithStatus.filter((t) => t.status === 'passed').length,
      averageScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length) : null,
    },
  };
}

// GET /api/learning/my
export async function getMyLearning(req, res) {
  const settings = await Settings.getSettings();
  sendSuccess(res, { data: await buildRecords(req.user._id, todayInTz(settings.timezone)) });
}

// GET /api/learning/records/:userId - training record of an employee
export async function getTrainingRecords(req, res) {
  const isSelf = String(req.user._id) === req.params.userId;
  if (!isSelf && !(await canAuditEmployee(req.user, req.params.userId))) throw ApiError.forbidden();
  const settings = await Settings.getSettings();
  const user = await User.findById(req.params.userId).select('firstName lastName employeeCode avatar');
  if (!user) throw ApiError.notFound('Employee not found');
  sendSuccess(res, { data: { user, ...(await buildRecords(user._id, todayInTz(settings.timezone))) } });
}

// POST /api/learning/reminders/run - send due / overdue reminders now (also runs hourly)
export async function triggerReminders(_req, res) {
  const sent = await runReminders();
  sendSuccess(res, { data: { sent }, message: `${sent} reminder(s) sent` });
}
