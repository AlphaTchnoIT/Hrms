/*
 * Demo data for the workforce, performance, quality, employee relations, recruitment,
 * learning and support modules. Called from seed.js after employees and attendance exist.
 */
import {
  ActionPlan,
  Application,
  Attendance,
  Calibration,
  Escalation,
  Grievance,
  Interaction,
  JobPosting,
  KnowledgeTest,
  KpiRecord,
  QaFeedback,
  RatingReview,
  Roster,
  Suggestion,
  TestAttempt,
  Ticket,
  TrainingAssignment,
  TrainingProgram,
  Warning,
  WarningTrigger,
  generateCode,
  WorkStatusLog,
} from '../models/index.js';
import { QA_ERROR_CATEGORIES } from '../constants/index.js';
import { addDays, dayOfWeek, toDateStr, todayInTz, weekStart } from '../utils/date.js';
import { getPerformanceSummaries, targetFor } from '../services/performance.service.js';
import { KNOWLEDGE_TEST, TRAINING_PROGRAMS, WARNING_TRIGGERS } from './seedData.js';

// Each agent's typical level (0-100) per KPI, so the dashboards show a realistic mix
const PROFILES = {
  'employee@hrms.com': { quality: 94, efficiency: 91, classification: 97 }, // meeting target
  'vikram@hrms.com': { quality: 90, efficiency: 79, classification: 95 }, // efficiency needs attention
  'sneha@hrms.com': { quality: 78, efficiency: 86, classification: 91 }, // quality critical
  'karan@hrms.com': { quality: 86, efficiency: 64, classification: 90 }, // new joiner on glide path
  'neha@hrms.com': { quality: 92, efficiency: 88, classification: 96 },
  'arjun@hrms.com': { quality: 89, efficiency: 84, classification: 94 },
  'isha@hrms.com': { quality: 93, efficiency: 87, classification: 96 },
  'rahul@hrms.com': { quality: 95, efficiency: 90, classification: 98 },
};

export async function seedModules({ users, settings, today, random, randomInt }) {
  const qa = users['qa@hrms.com'];
  const hr = users['hr@hrms.com'];
  const manager = users['manager@hrms.com'];
  const it = users['it@hrms.com'];
  const agents = Object.keys(PROFILES).map((email) => users[email]);
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));
  const jitter = (base, spread) => clamp(base + (random() - 0.5) * 2 * spread);

  /* ---------- Roster: next two weeks, a mix of shifts for the engineering team ---------- */
  const shifts = {
    'employee@hrms.com': { shiftName: 'General', startTime: '09:30', endTime: '18:30', offs: [0, 6] },
    'vikram@hrms.com': { shiftName: 'Morning', startTime: '07:00', endTime: '16:00', offs: [0, 1] },
    'sneha@hrms.com': { shiftName: 'Evening', startTime: '13:00', endTime: '22:00', offs: [5, 6] },
    'karan@hrms.com': { shiftName: 'General', startTime: '09:30', endTime: '18:30', offs: [0, 6] },
  };
  const rosterDocs = [];
  Object.entries(shifts).forEach(([email, s]) => {
    for (let i = 0; i < 14; i += 1) {
      const date = addDays(today, i);
      rosterDocs.push({ user: users[email]._id, date, shiftName: s.shiftName, startTime: s.startTime, endTime: s.endTime, isWeeklyOff: s.offs.includes(dayOfWeek(date)), createdBy: manager._id });
    }
  });
  await Roster.insertMany(rosterDocs);

  /* ---------- Productive (AT) and idle minutes on past logins ---------- */
  const records = await Attendance.find({ date: { $lt: today } }).select('workMinutes');
  await Attendance.bulkWrite(
    records.map((r) => {
      const idle = randomInt(10, random() < 0.1 ? 110 : 55);
      return { updateOne: { filter: { _id: r._id }, update: { $set: { idleMinutes: idle, productiveMinutes: Math.max(0, r.workMinutes - idle - randomInt(30, 60)) } } } };
    })
  );

  /* ---------- Daily efficiency and weekly classification for 13 weeks ---------- */
  const kpis = [];
  const from = addDays(today, -90);
  for (const agent of agents) {
    const profile = PROFILES[agent.email];
    const joined = toDateStr(agent.dateOfJoining);
    const worked = new Set((await Attendance.find({ user: agent._id, date: { $gte: from, $lt: today } }).select('date')).map((a) => a.date));
    worked.forEach((date) => {
      // New joiners improve week by week
      const ramp = agent.email === 'karan@hrms.com' ? (Date.parse(date) - Date.parse(joined)) / 86400000 / 2 : 0;
      kpis.push({ user: agent._id, metric: 'efficiency', period: 'daily', date, score: jitter(profile.efficiency + ramp, 6), target: targetFor('efficiency', agent, settings, date), recordedBy: manager._id });
    });
    for (let week = weekStart(from); week < today; week = addDays(week, 7)) {
      if (week < joined) continue;
      kpis.push({ user: agent._id, metric: 'classification', period: 'weekly', date: week, score: jitter(profile.classification, 3), target: settings.kpiTargets.classification, recordedBy: manager._id });
    }
  }

  /* ---------- Interactions + QA audits (2 a week per agent), weekly quality KPI ---------- */
  const audits = [];
  const interactions = [];
  let interactionNo = 1000;
  for (const agent of agents) {
    const profile = PROFILES[agent.email];
    const joined = toDateStr(agent.dateOfJoining);
    for (let week = weekStart(from); week < today; week = addDays(week, 7)) {
      if (week < joined) continue;
      for (const offset of [1, 3]) {
        const auditDate = addDays(week, offset);
        if (auditDate >= today) continue;
        interactionNo += 1;
        const reference = `INT-${interactionNo}`;
        const score = Math.round(jitter(profile.quality, 7));
        const isFatal = profile.quality < 80 && random() < 0.12;
        const errors = score < 90 || isFatal ? [QA_ERROR_CATEGORIES[randomInt(0, profile.quality < 80 ? 2 : 8)]] : [];
        interactions.push({ reference, agent: agent._id, channel: ['call', 'chat', 'email'][randomInt(0, 2)], customerName: `Customer ${interactionNo}`, summary: 'Billing query resolved on first contact', resolvedAt: new Date(`${addDays(auditDate, -1)}T10:00:00Z`), createdBy: qa._id });
        audits.push({
          user: agent._id, auditor: qa._id, interactionRef: reference, auditDate, score, isFatal, errorCategories: errors,
          strengths: 'Polite greeting and clear closing',
          improvements: errors.length ? `Work on ${errors.join(', ')}` : '',
          acknowledgedAt: auditDate < addDays(today, -7) ? new Date(`${auditDate}T15:00:00Z`) : null,
        });
      }
    }
  }
  // Fresh resolved interactions for calibration selection
  for (let i = 0; i < 8; i += 1) {
    interactionNo += 1;
    interactions.push({ reference: `INT-${interactionNo}`, agent: agents[i % 4]._id, channel: 'call', customerName: `Customer ${interactionNo}`, summary: 'Plan change request', resolvedAt: new Date(Date.now() - (i + 1) * 20 * 3600 * 1000), createdBy: qa._id });
  }
  const savedInteractions = await Interaction.insertMany(interactions);
  const byRef = Object.fromEntries(savedInteractions.map((i) => [i.reference, i._id]));
  await QaFeedback.insertMany(audits.map((a) => ({ ...a, interaction: byRef[a.interactionRef] })));

  const weekly = {};
  audits.forEach((a) => {
    const key = `${a.user}|${weekStart(a.auditDate)}`;
    (weekly[key] = weekly[key] || []).push(a.isFatal ? 0 : a.score);
  });
  Object.entries(weekly).forEach(([key, scores]) => {
    const [user, date] = key.split('|');
    kpis.push({ user, metric: 'quality', period: 'weekly', date, score: clamp(scores.reduce((s, x) => s + x, 0) / scores.length), target: settings.kpiTargets.quality, source: 'qa-audit', remarks: `Average of ${scores.length} QA audit(s)` });
  });
  await KpiRecord.insertMany(kpis);

  /* ---------- Calibrations: pending, scored, agreed ---------- */
  const recent = savedInteractions.slice(-3);
  await Calibration.insertMany([
    { interaction: recent[0]._id, frequency: 'weekly', selectedBy: qa._id, managerAudit: { auditor: manager._id, score: 88, notes: 'Missed the empathy statement', at: new Date() }, status: 'pending' },
    { interaction: recent[1]._id, frequency: 'weekly', selectedBy: qa._id, managerAudit: { auditor: manager._id, score: 92, at: new Date() }, qaAudit: { auditor: qa._id, score: 84, notes: 'Verification step skipped', at: new Date() }, variance: 8, accuracy: 92, isAligned: false, status: 'scored' },
    { interaction: recent[2]._id, frequency: 'daily', selectedBy: qa._id, managerAudit: { auditor: manager._id, score: 90, at: new Date() }, qaAudit: { auditor: qa._id, score: 87, at: new Date() }, variance: 3, accuracy: 97, isAligned: true, agreedScore: 88, managerSignOff: { by: manager._id, at: new Date() }, qaSignOff: { by: qa._id, at: new Date() }, status: 'agreed' },
  ]);

  /* ---------- Employee relations ---------- */
  await WarningTrigger.insertMany(WARNING_TRIGGERS);
  const sneha = users['sneha@hrms.com'];
  const vikram = users['vikram@hrms.com'];
  const escalation = await Escalation.create({
    refNo: await generateCode('escalation', 'ESC'),
    employee: sneha._id,
    raisedBy: manager._id,
    category: 'quality',
    incident: 'Repeated verification misses on customer calls despite coaching.',
    incidentDate: addDays(today, -24),
    evidence: 'QA audits INT-1010, INT-1019 and INT-1024',
    expectations: 'Follow the verification checklist on every call',
    followUpDate: addDays(today, 4),
    status: 'under-review',
    history: [
      { action: 'Escalation raised', note: 'Repeated verification misses', by: manager._id, at: new Date(`${addDays(today, -24)}T11:00:00Z`) },
      { action: 'Status: open → under-review', note: 'HR reviewing with the manager', by: hr._id, at: new Date(`${addDays(today, -22)}T11:00:00Z`) },
    ],
  });
  await Warning.insertMany([
    {
      refNo: await generateCode('warning', 'WRN'), employee: sneha._id, issuedBy: manager._id, category: 'quality', stage: 1,
      reason: 'Verification step skipped on audited calls', issuedDate: addDays(today, -40), expiresOn: addDays(today, 140), status: 'acknowledged',
      acknowledgedAt: new Date(`${addDays(today, -39)}T10:00:00Z`), employeeComment: 'Understood, I will follow the checklist.',
      history: [
        { action: 'Stage 1 – Verbal warning issued', by: manager._id, at: new Date(`${addDays(today, -40)}T10:00:00Z`) },
        { action: 'Acknowledged by employee', note: 'Understood, I will follow the checklist.', by: sneha._id, at: new Date(`${addDays(today, -39)}T10:00:00Z`) },
      ],
    },
    {
      refNo: await generateCode('warning', 'WRN'), employee: sneha._id, issuedBy: manager._id, category: 'quality', stage: 2, escalation: escalation._id,
      reason: 'Quality below 80% for three consecutive weeks', expectations: 'Reach 90% quality within 30 days', issuedDate: addDays(today, -20), expiresOn: addDays(today, 160), status: 'issued',
      history: [{ action: 'Stage 2 – First written warning issued', by: manager._id, at: new Date(`${addDays(today, -20)}T10:00:00Z`) }],
    },
    {
      refNo: await generateCode('warning', 'WRN'), employee: vikram._id, issuedBy: manager._id, category: 'attendance', stage: 1,
      reason: 'Late logins on 5 days this month', issuedDate: addDays(today, -6), expiresOn: addDays(today, 84), status: 'issued',
      history: [{ action: 'Stage 1 – Verbal warning issued', by: manager._id, at: new Date(`${addDays(today, -6)}T10:00:00Z`) }],
    },
  ]);

  /* ---------- Action plans ---------- */
  await ActionPlan.insertMany([
    {
      user: sneha._id, metric: 'quality', title: 'Improve quality from 78% to 90%', reason: 'Quality critical for 3 weeks',
      baselineScore: 77.5, targetScore: 90, startDate: addDays(today, -21), deadline: addDays(today, 9), followUpDate: addDays(today, 2),
      actions: [
        { description: 'Review 3 top-scoring calls with QA every week', isDone: true, doneAt: new Date() },
        { description: 'Daily 10-minute refresher on verification', isDone: true, doneAt: new Date() },
        { description: 'Side-by-side coaching twice a week', isDone: false },
      ],
      checkIns: [{ date: addDays(today, -14), note: 'Calls reviewed, verification improving', score: 81, by: manager._id }, { date: addDays(today, -7), note: 'Two clean audits this week', score: 84, by: manager._id }],
      status: 'in-progress', employeeAcknowledgedAt: new Date(`${addDays(today, -20)}T10:00:00Z`), createdBy: manager._id,
    },
    {
      user: vikram._id, metric: 'efficiency', title: 'Improve efficiency from 79% to 85%', reason: 'Efficiency below target',
      baselineScore: 78.8, targetScore: 85, startDate: addDays(today, -10), deadline: addDays(today, 35), followUpDate: addDays(today, -1),
      actions: [{ description: 'Shadow a top performer for two sessions' }, { description: 'Use knowledge base templates for common queries' }],
      status: 'open', createdBy: manager._id,
    },
  ]);

  /* ---------- Last month's ratings (HR + QA approval workflow) ---------- */
  const [year, month] = today.split('-').map(Number);
  const lastMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const lastStart = `${lastMonth}-01`;
  const lastEnd = addDays(month === 1 ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`, -1);
  const team = agents.filter((a) => String(a.reportingManager) === String(manager._id));
  const summaries = await getPerformanceSummaries(team, { from: lastStart, to: lastEnd, settings });
  const ratings = team
    .filter((a) => summaries[String(a._id)].rating)
    .map((a, index) => {
      const s = summaries[String(a._id)];
      const approved = index % 2 === 0;
      return {
        user: a._id, period: lastMonth,
        scores: { quality: s.metrics.quality.score, efficiency: s.metrics.efficiency.score, classification: s.metrics.classification.score, adherence: s.metrics.adherence.score },
        compositeScore: s.compositeScore, systemRating: s.rating, finalRating: s.rating,
        qaApproval: approved || index === 1 ? { by: qa._id, at: new Date(), approved: true } : {},
        hrApproval: approved ? { by: hr._id, at: new Date(), approved: true } : {},
        status: approved ? 'approved' : 'pending-approval', generatedBy: manager._id,
      };
    });
  if (ratings.length) await RatingReview.insertMany(ratings);

  /* ---------- Recruitment ---------- */
  const qaJob = await JobPosting.create({
    refNo: await generateCode('job', 'JOB'), title: 'QA Auditor', location: 'Bengaluru', description: 'Audit customer interactions, give feedback to agents and run calibration sessions with managers.',
    requirements: '12+ months as an agent with quality above 90%', openings: 2, isInternal: true, minTenureMonths: 12, closingDate: addDays(today, 20), status: 'open', createdBy: hr._id,
  });
  const engJob = await JobPosting.create({
    refNo: await generateCode('job', 'JOB'), title: 'Senior Software Engineer', location: 'Bengaluru / Hybrid', description: 'Build and scale the payments platform with a small, senior team.',
    requirements: '5+ years with Node.js and React', openings: 1, isInternal: false, closingDate: addDays(today, 30), status: 'open', createdBy: hr._id,
  });
  const interviewAt = new Date(Date.now() + 2 * 86400000);
  interviewAt.setUTCHours(6, 0, 0, 0);
  await Application.insertMany([
    {
      refNo: await generateCode('application', 'APP'), job: qaJob._id, applicant: users['employee@hrms.com']._id, source: 'internal', coverNote: 'I have consistently scored above 90% in quality and coach new joiners.',
      status: 'interview-scheduled', statusHistory: [{ status: 'received', by: users['employee@hrms.com']._id }, { status: 'under-review', by: hr._id }, { status: 'interview-scheduled', by: hr._id }],
      interviews: [{ round: 'Panel interview', scheduledAt: interviewAt, mode: 'video', location: 'https://meet.example.com/qa-panel', interviewers: [qa._id, hr._id] }],
    },
    {
      refNo: await generateCode('application', 'APP'), job: engJob._id, candidate: { name: 'Rhea Kulkarni', email: 'rhea.candidate@example.com', phone: '+91 9811122233' }, source: 'external',
      resumeUrl: 'https://example.com/resume/rhea.pdf', status: 'offer-sent',
      statusHistory: ['received', 'under-review', 'interview-scheduled', 'selected', 'offer-sent'].map((status) => ({ status, by: hr._id })),
      interviews: [{ round: 'Technical', scheduledAt: new Date(Date.now() - 6 * 86400000), mode: 'video', interviewers: [manager._id], result: 'passed', feedback: 'Strong system design' }],
      documents: [
        { name: 'PAN card', status: 'verified', url: 'https://example.com/docs/pan.pdf', submittedAt: new Date() },
        { name: 'Last 3 payslips', status: 'requested' },
        { name: 'Relieving letter', status: 'requested' },
      ],
    },
    {
      refNo: await generateCode('application', 'APP'), job: engJob._id, candidate: { name: 'Kabir Shah', email: 'kabir.candidate@example.com' }, source: 'referral',
      status: 'under-review', statusHistory: [{ status: 'received', by: hr._id }, { status: 'under-review', by: hr._id }],
    },
  ]);

  /* ---------- Learning ---------- */
  const programs = await TrainingProgram.insertMany(TRAINING_PROGRAMS.map((p) => ({ ...p, createdBy: hr._id })));
  const assignments = [];
  agents.slice(0, 4).forEach((agent, i) => {
    assignments.push({ program: programs[0]._id, user: agent._id, assignedBy: manager._id, dueDate: addDays(today, 5), progress: [100, 60, 20, 0][i], status: ['completed', 'in-progress', 'in-progress', 'assigned'][i], completedAt: i === 0 ? new Date() : undefined });
    assignments.push({ program: programs[1]._id, user: agent._id, assignedBy: manager._id, dueDate: addDays(today, -3), progress: [100, 100, 40, 10][i], status: ['completed', 'completed', 'in-progress', 'in-progress'][i], completedAt: i < 2 ? new Date() : undefined });
  });
  agents.forEach((agent) => assignments.push({ program: programs[2]._id, user: agent._id, assignedBy: hr._id, dueDate: addDays(today, 25) }));
  await TrainingAssignment.insertMany(assignments);

  const test = await KnowledgeTest.create({ ...KNOWLEDGE_TEST, dueDate: addDays(today, 2), createdBy: qa._id });
  await TestAttempt.insertMany([
    { test: test._id, user: users['employee@hrms.com']._id, attemptNo: 1, answers: [1, 2, 1, 2, 1], score: 5, totalMarks: 5, percent: 100, passed: true },
    { test: test._id, user: sneha._id, attemptNo: 1, answers: [0, 2, 1, 0, 1], score: 3, totalMarks: 5, percent: 60, passed: false },
  ]);

  /* ---------- Support ---------- */
  const ticketNo = () => generateCode('ticket', 'TKT');
  await Ticket.insertMany([
    { ticketNo: await ticketNo(), raisedBy: vikram._id, category: 'hardware', priority: 'high', subject: 'Headset microphone not working', description: 'Customers cannot hear me since this morning.', status: 'in-progress', assignedTo: it._id, comments: [{ by: it._id, message: 'Replacement headset is on the way to your desk.' }] },
    { ticketNo: await ticketNo(), raisedBy: users['employee@hrms.com']._id, category: 'access-request', priority: 'medium', subject: 'Access to the reporting dashboard', description: 'Need read access to the team reporting dashboard.', status: 'open' },
    { ticketNo: await ticketNo(), raisedBy: manager._id, category: 'software', priority: 'low', subject: 'Upgrade VPN client', description: 'VPN client shows an update prompt.', status: 'resolved', assignedTo: it._id, resolution: 'Upgraded to the latest version remotely', resolvedAt: new Date() },
  ]);
  await Grievance.create({ refNo: await generateCode('grievance', 'GRV'), submittedBy: users['isha@hrms.com']._id, isAnonymous: true, category: 'workplace', subject: 'Cafeteria seating during peak hours', description: 'There are not enough seats during lunch, people eat at their desks.', status: 'under-review', handledBy: hr._id, responses: [{ by: hr._id, message: 'Thank you, we are looking at staggered lunch slots.' }] });
  await Suggestion.insertMany([
    { submittedBy: users['arjun@hrms.com']._id, type: 'idea', title: 'Monthly customer-story session', description: 'Share one great customer story every month in the town hall.', status: 'planned', response: 'Starting next month!', respondedBy: hr._id },
    { submittedBy: vikram._id, type: 'feedback', title: 'Roster published earlier', description: 'Please publish the roster at least 10 days ahead.', status: 'new' },
  ]);

  /* ---------- Live Work Status: last 7 working days from attendance, plus a few people working right now ---------- */
  const statusOf = Object.fromEntries(settings.workStatuses.map((st) => [st.key, st]));
  const PATTERN = [
    ['available', 50, 110], ['email', 25, 60], ['break', 10, 20], ['available', 40, 90], ['meeting', 20, 45],
    ['lunch', 30, 45], ['social', 25, 60], ['available', 40, 80], ['back-office', 20, 50], ['break', 10, 25], ['available', 30, 90],
  ];
  const NOTES = { email: 'Customer escalations inbox', social: 'Twitter & Instagram DMs', meeting: 'Team huddle', 'back-office': 'Ticket follow-ups' };
  const buildDay = (user, date, start, end) => {
    const logs = [];
    let at = start.getTime();
    let i = 0;
    while (at < end.getTime()) {
      let [key, min, max] = PATTERN[i % PATTERN.length];
      if (random() < 0.06) [key, min, max] = random() < 0.5 ? ['it-issue', 10, 30] : ['away', 5, 25];
      const st = statusOf[key];
      const until = Math.min(at + randomInt(min, max) * 60000, end.getTime());
      logs.push({ user: user._id, date, status: st.key, label: st.label, category: st.category, note: random() < 0.4 ? NOTES[key] : undefined, startedAt: new Date(at), endedAt: new Date(until), endReason: 'changed' });
      at = until;
      i += 1;
    }
    if (logs.length) logs[logs.length - 1].endReason = 'check-out';
    return logs;
  };

  const statusLogs = [];
  const lastWeek = await Attendance.find({ date: { $gte: addDays(today, -7), $lt: today }, 'checkOut.time': { $exists: true } });
  lastWeek.forEach((a) => statusLogs.push(...buildDay({ _id: a.user }, a.date, a.checkIn.time, a.checkOut.time)));

  // Not the demo login accounts, so those can still try check-in themselves
  const now = new Date();
  for (const email of ['sneha@hrms.com', 'karan@hrms.com', 'neha@hrms.com', 'arjun@hrms.com', 'isha@hrms.com']) {
    const user = users[email];
    const start = new Date(now.getTime() - randomInt(70, 330) * 60000);
    if (todayInTz(settings.timezone, start) !== today) continue; // too early in the day for a believable shift
    await Attendance.create({ user: user._id, date: today, checkIn: { time: start, ip: '127.0.0.1' }, status: 'present', source: 'web' });
    const logs = buildDay(user, today, start, now);
    const last = logs[logs.length - 1];
    if (last) {
      last.endedAt = null;
      last.endReason = undefined;
    }
    statusLogs.push(...logs);
  }
  await WorkStatusLog.insertMany(statusLogs);

  console.log(`✓ Roster, ${kpis.length} KPI results, ${audits.length} QA audits, calibrations, warnings, action plans, ratings, recruitment, learning, support`);
}
