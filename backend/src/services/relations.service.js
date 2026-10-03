import { KpiRecord, QaFeedback, Warning, WarningTrigger } from '../models/index.js';
import { addDays, todayInTz } from '../utils/date.js';
import { targetFor } from './performance.service.js';
import { getWorkforce } from './workforce.service.js';

const ACTIVE_WARNING = ['issued', 'acknowledged'];

// Warnings that still count: not withdrawn and not past their expiry date
export function activeWarningFilter(today) {
  return { status: { $in: ACTIVE_WARNING }, $or: [{ expiresOn: null }, { expiresOn: { $exists: false } }, { expiresOn: { $gte: today } }] };
}

// Next stage for a new warning in the same category: highest active stage + 1 (max 4)
export async function suggestNextStage(employeeId, category, today) {
  const latest = await Warning.findOne({ employee: employeeId, category, ...activeWarningFilter(today) }).sort({ stage: -1 });
  return Math.min((latest?.stage || 0) + 1, 4);
}

const TRIGGER_LABELS = {
  'kpi-failure': (t) => `${t.metric || 'KPI'} below target`,
  'qa-errors': () => 'QA audits with errors',
  'late-logins': () => 'late logins',
  'short-logins': () => 'short logins',
  absences: () => 'unplanned absences',
};

/*
 * Runs every active warning trigger for the given users.
 * Returns [{ user, trigger, count, threshold, windowDays, message }] for each breach.
 */
export async function evaluateTriggers(users, settings) {
  const triggers = await WarningTrigger.find({ isActive: true });
  if (!triggers.length || !users.length) return [];

  const today = todayInTz(settings.timezone);
  const maxWindow = Math.max(...triggers.map((t) => t.windowDays));
  const from = addDays(today, -(maxWindow - 1));
  const userIds = users.map((u) => u._id);
  const userMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

  const needsWorkforce = triggers.some((t) => ['late-logins', 'short-logins', 'absences'].includes(t.type));
  const [kpis, audits, workforce] = await Promise.all([
    triggers.some((t) => t.type === 'kpi-failure') ? KpiRecord.find({ user: { $in: userIds }, date: { $gte: from } }) : [],
    triggers.some((t) => t.type === 'qa-errors') ? QaFeedback.find({ user: { $in: userIds }, auditDate: { $gte: from } }) : [],
    needsWorkforce ? getWorkforce(users, from, today, settings) : {},
  ]);

  const flags = [];
  triggers.forEach((trigger) => {
    const since = addDays(today, -(trigger.windowDays - 1));

    users.forEach((user) => {
      const id = String(user._id);
      let count = 0;

      if (trigger.type === 'kpi-failure') {
        count = kpis.filter(
          (k) =>
            String(k.user) === id &&
            k.date >= since &&
            (!trigger.metric || k.metric === trigger.metric) &&
            k.score < (k.target ?? targetFor(k.metric, userMap[id], settings, k.date))
        ).length;
      } else if (trigger.type === 'qa-errors') {
        count = audits.filter((a) => String(a.user) === id && a.auditDate >= since && (a.isFatal || a.errorCategories.length)).length;
      } else {
        const days = (workforce[id]?.days || []).filter((d) => d.date >= since);
        if (trigger.type === 'late-logins') count = days.filter((d) => d.isLate).length;
        if (trigger.type === 'short-logins') count = days.filter((d) => d.isShort).length;
        if (trigger.type === 'absences') count = days.filter((d) => d.status === 'absent').length;
      }

      if (count >= trigger.threshold) {
        flags.push({
          user: id,
          trigger: { _id: trigger._id, name: trigger.name, type: trigger.type, metric: trigger.metric, category: trigger.category },
          count,
          threshold: trigger.threshold,
          windowDays: trigger.windowDays,
          message: `${count} ${TRIGGER_LABELS[trigger.type](trigger)} in the last ${trigger.windowDays} days (limit ${trigger.threshold})`,
        });
      }
    });
  });

  return flags;
}
