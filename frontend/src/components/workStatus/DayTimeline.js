'use client';

import clsx from 'clsx';
import { formatTime } from '@/lib/format';
import { WORK_CATEGORIES, WORK_CATEGORY_KEYS, formatMinutes } from '@/lib/workStatus';
import { EmptyState } from '@/components/ui';
import StatusPill from './StatusPill';

// Time per category for the day, e.g. "Productive 5h 10m (78%)"
export function CategoryTotals({ summary, className }) {
  const total = summary?.total || 0;
  return (
    <div className={clsx('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5', className)}>
      {WORK_CATEGORY_KEYS.map((key) => {
        const minutes = summary?.categories?.[key] || 0;
        return (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className={clsx('h-2 w-2 rounded-full', WORK_CATEGORIES[key].dot)} />
              {WORK_CATEGORIES[key].label}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{formatMinutes(minutes)}</p>
            <p className="text-xs text-slate-400">{total ? Math.round((minutes / total) * 100) : 0}% of tracked time</p>
          </div>
        );
      })}
    </div>
  );
}

/*
 * One person's day: totals, a colour bar of the whole day and the list of status changes.
 *   day = response of GET /work-status/day
 */
export default function DayTimeline({ day }) {
  const logs = day?.logs || [];
  if (!logs.length) {
    return <EmptyState message={day?.checkIn ? 'No status changes recorded for this day.' : 'Not checked in on this day.'} />;
  }

  const now = Date.now();
  const start = new Date(logs[0].since).getTime();
  const end = Math.max(...logs.map((l) => new Date(l.endedAt || now).getTime()));
  const span = Math.max(end - start, 1);

  return (
    <div className="space-y-5">
      <CategoryTotals summary={day.summary} />

      <div>
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
          {logs.map((log, index) => {
            const from = new Date(log.since).getTime();
            const to = new Date(log.endedAt || now).getTime();
            return (
              <div
                key={index}
                className={clsx('h-full', WORK_CATEGORIES[log.category]?.bar)}
                style={{ width: `${((to - from) / span) * 100}%` }}
                title={`${log.label} · ${formatTime(log.since)}–${log.endedAt ? formatTime(log.endedAt) : 'now'} (${formatMinutes(log.minutes)})`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          <span>{formatTime(start)}</span>
          <span>{logs.some((l) => !l.endedAt) ? 'Now' : formatTime(end)}</span>
        </div>
      </div>

      <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {logs.map((log, index) => (
          <li key={index} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
            <span className="w-40 shrink-0 tabular-nums text-slate-500">
              {formatTime(log.since)} – {log.endedAt ? formatTime(log.endedAt) : 'now'}
            </span>
            <StatusPill current={log} />
            <span className="font-medium tabular-nums text-slate-700">{formatMinutes(log.minutes)}</span>
            {log.note && <span className="min-w-0 flex-1 truncate text-slate-500">“{log.note}”</span>}
            {log.endReason === 'auto-closed' && <span className="text-xs text-amber-600">closed automatically (no check-out)</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
