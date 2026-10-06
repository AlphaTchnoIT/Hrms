import { ActionPlan, Application, ComplianceItem, Holiday, KnowledgeTest, Settings, TestAttempt, TrainingAssignment, User, Warning } from '../models/index.js';
import { addDays, todayInTz } from '../utils/date.js';
import { notifyOnce, sendEmail } from './notification.service.js';
import { syncUkBankHolidays } from './bankHolidays.service.js';
import { getPolicies } from './policy.service.js';

/*
 * Automatic reminders. Each reminder has a dedupe key so running this often never sends duplicates.
 * Runs hourly from server.js and can be triggered manually by HR.
 * Returns the number of reminders sent.
 */
export async function runReminders() {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const soon = addDays(today, 2);
  let sent = 0;
  const send = async (key, userId, payload) => {
    if (await notifyOnce(key, userId, payload)) sent += 1;
  };

  // Knowledge tests: due in the next 2 days or overdue (up to a week), not yet passed
  const tests = await KnowledgeTest.find({ isPublished: true, dueDate: { $gte: addDays(today, -7), $lte: soon } });
  if (tests.length) {
    const everyone = await User.find({ status: 'active' }).distinct('_id');
    for (const test of tests) {
      const audience = test.assignedTo.length ? test.assignedTo : everyone;
      const attempts = await TestAttempt.find({ test: test._id }).select('user passed');
      for (const userId of audience) {
        const mine = attempts.filter((a) => String(a.user) === String(userId));
        if (mine.some((a) => a.passed) || mine.length >= test.maxAttempts) continue;
        const overdue = test.dueDate < today;
        await send(`test-${overdue ? 'overdue' : 'due'}:${test._id}:${userId}`, userId, {
          title: overdue ? 'Knowledge test overdue' : 'Knowledge test due soon',
          message: `"${test.title}" ${overdue ? 'was due' : 'is due'} on ${test.dueDate}`,
          link: '/learning?tab=tests',
        });
      }
    }
  }

  // Training assignments
  const trainings = await TrainingAssignment.find({ status: { $ne: 'completed' }, dueDate: { $lte: soon } }).populate('program', 'title');
  for (const t of trainings) {
    const overdue = t.dueDate < today;
    await send(`training-${overdue ? 'overdue' : 'due'}:${t._id}`, t.user, {
      title: overdue ? 'Training overdue' : 'Training due soon',
      message: `"${t.program?.title}" ${overdue ? 'was due' : 'is due'} on ${t.dueDate} (${t.progress}% done)`,
      link: '/learning',
    });
  }

  // Action plan follow-ups due today -> the manager who created the plan
  const plans = await ActionPlan.find({ status: { $in: ['open', 'in-progress'] }, followUpDate: { $lte: today } }).populate('user', 'firstName lastName');
  for (const plan of plans) {
    if (!plan.createdBy) continue;
    await send(`plan-followup:${plan._id}:${plan.followUpDate}`, plan.createdBy, {
      title: 'Action plan follow-up due',
      message: `${plan.user?.firstName} ${plan.user?.lastName}: "${plan.title}"`,
      link: '/team/action-plans',
    });
  }

  // Warnings not acknowledged after 2 days
  const pendingWarnings = await Warning.find({ status: 'issued', createdAt: { $lte: new Date(Date.now() - 2 * 86400000) } });
  for (const w of pendingWarnings) {
    await send(`warning-ack:${w._id}`, w.employee, {
      title: 'Please acknowledge your warning',
      message: `${w.refNo} is waiting for your electronic acknowledgement`,
      link: '/my-conduct',
    });
  }

  // Right to work: time-limited permission expiring in 60 / 30 days or already expired -> HR (UK: follow-up check needed)
  const hrTeam = await User.find({ role: { $in: ['hr', 'admin'] }, status: 'active' }).distinct('_id');
  const policies = getPolicies(settings);
  const expiring = await User.find({ status: 'active', 'rightToWork.status': 'time-limited', 'rightToWork.expiryDate': { $lte: addDays(today, policies.rightToWorkFirstReminderDays) } }).select(
    'firstName lastName rightToWork'
  );
  for (const person of expiring) {
    const expiry = person.rightToWork.expiryDate;
    const stage = expiry < today ? 'expired' : expiry <= addDays(today, policies.rightToWorkSecondReminderDays) ? 'second' : 'first';
    const message =
      stage === 'expired'
        ? `${person.firstName} ${person.lastName}'s permission to work expired on ${expiry}. Check it now.`
        : `${person.firstName} ${person.lastName}'s permission to work expires on ${expiry}. Do a follow-up right to work check.`;
    for (const hrId of hrTeam) {
      await send(`rtw-${stage}:${person._id}:${expiry}:${hrId}`, hrId, { title: 'Right to work check due', message, link: `/employees/${person._id}` });
    }
  }

  // Probation ending in the next 14 days -> manager and HR (review meeting / confirmation letter)
  const probations = await User.find({ status: 'active', probationEndDate: { $gte: today, $lte: addDays(today, policies.probationReminderDays) } }).select('firstName lastName probationEndDate reportingManager');
  for (const person of probations) {
    const payload = { title: 'Probation review due', message: `${person.firstName} ${person.lastName}'s probation ends on ${person.probationEndDate}` };
    for (const userId of [person.reportingManager, ...hrTeam].filter(Boolean)) {
      const isHrUser = hrTeam.some((id) => String(id) === String(userId));
      await send(`probation:${person._id}:${person.probationEndDate}:${userId}`, userId, { ...payload, link: isHrUser ? `/employees/${person._id}` : '/team/home' });
    }
  }

  // Bank holidays: load this year's / next year's from GOV.UK once they are published (only if none exist yet)
  for (const year of [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]) {
    if (await Holiday.exists({ date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` }, type: { $in: ['bank-holiday', 'regional'] } })) continue;
    try {
      await syncUkBankHolidays({ from: `${year}-01-01`, to: `${year}-12-31` });
    } catch (error) {
      console.error(`Bank holiday sync for ${year} failed:`, error.message);
    }
  }

  // Compliance checklist: items whose review date has come (e.g. yearly policy review) -> admins
  const dueReviews = await ComplianceItem.find({ status: { $ne: 'not-applicable' }, nextReviewOn: { $lte: today } });
  if (dueReviews.length) {
    const admins = await User.find({ role: 'admin', status: 'active' }).distinct('_id');
    for (const item of dueReviews) {
      for (const adminId of admins) {
        await send(`compliance:${item._id}:${item.nextReviewOn}:${adminId}`, adminId, { title: 'Compliance review due', message: `"${item.title}" was due for review on ${item.nextReviewOn}`, link: '/compliance' });
      }
    }
  }

  // Interviews in the next 24 hours
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const apps = await Application.find({ interviews: { $elemMatch: { scheduledAt: { $gte: now, $lte: tomorrow }, result: 'pending' } } }).populate('job', 'title');
  for (const app of apps) {
    for (const interview of app.interviews.filter((i) => i.result === 'pending' && i.scheduledAt >= now && i.scheduledAt <= tomorrow)) {
      const when = interview.scheduledAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: settings.timezone });
      const payload = { title: 'Interview reminder', message: `${interview.round} for ${app.job?.title} at ${when}`, link: '/careers?tab=interviews' };
      for (const panelist of interview.interviewers) await send(`interview:${interview._id}:${panelist}`, panelist, payload);
      if (app.applicant) await send(`interview:${interview._id}:${app.applicant}`, app.applicant, { ...payload, link: '/careers' });
      else if (app.candidate?.email && !interview.reminderSentAt) {
        sendEmail(app.candidate.email, payload.title, payload.message);
        interview.reminderSentAt = new Date();
        await app.save();
        sent += 1;
      }
    }
  }

  return sent;
}

let timer = null;

// Starts the hourly reminder job (no-op if already running)
export function startReminderJob(intervalMs = 60 * 60 * 1000) {
  if (timer) return;
  const run = () => runReminders().catch((error) => console.error('Reminder job failed:', error.message));
  setTimeout(run, 10 * 1000);
  timer = setInterval(run, intervalMs);
}
