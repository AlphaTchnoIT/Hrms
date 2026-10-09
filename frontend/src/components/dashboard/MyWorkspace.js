import Link from 'next/link';
import { CalendarRange, ClipboardCheck, Gauge, GraduationCap } from 'lucide-react';
import { formatDay } from '@/lib/format';
import { METRIC_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui';
import { PerformanceStatus, RatingStars } from '@/components/performance/KpiWidgets';

function Tile({ href, icon: Icon, title, children }) {
  return (
    <Link href={href} className="card flex flex-col gap-2 p-4 transition hover:border-brand-200 hover:shadow-md">
      <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
        <Icon className="h-4 w-4 text-brand-500" /> {title}
      </div>
      {children}
    </Link>
  );
}

// Next shifts, performance status and things waiting for the employee
export default function MyWorkspace({ work }) {
  if (!work) return null;
  const ack = work.toAcknowledge;
  const pendingAck = ack.qaFeedback + ack.warnings + ack.actionPlans;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile href="/roster" icon={CalendarRange} title="My next shifts">
        <ul className="space-y-1 text-sm">
          {work.shifts.map((d) => (
            <li key={d.date} className="flex items-center justify-between gap-2">
              <span className="text-slate-600">{formatDay(d.date)}</span>
              {d.shift.isWeeklyOff || d.holiday ? (
                <Badge status={d.holiday ? 'holiday' : 'weekly-off'} />
              ) : (
                <span className="font-medium text-slate-800">
                  {d.shift.startTime}–{d.shift.endTime}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Tile>
      <Tile href="/performance" icon={Gauge} title="My performance (30 days)">
        <PerformanceStatus status={work.performance.status} />
        {work.performance.below?.length > 0 && (
          <p className="text-xs text-slate-500">
            {work.performance.below.map((b) => `${METRIC_LABELS[b.metric] || b.metric} ${b.score}% (target ${b.target}%)`).join(' · ')}
          </p>
        )}
        <div className="flex items-center gap-2">
          <RatingStars value={work.performance.rating} />
          {work.performance.compositeScore !== null && <span className="text-xs text-slate-500">score {work.performance.compositeScore}</span>}
        </div>
      </Tile>
      <Tile href={ack.warnings ? '/my-conduct' : ack.qaFeedback ? '/quality' : '/performance?tab=action-plans'} icon={ClipboardCheck} title="Waiting for my acknowledgement">
        <p className={`text-2xl font-semibold ${pendingAck ? 'text-amber-600' : 'text-slate-900'}`}>{pendingAck}</p>
        <p className="text-xs text-slate-500">
          {ack.qaFeedback} QA feedback · {ack.warnings} warning(s) · {ack.actionPlans} action plan(s)
        </p>
      </Tile>
      <Tile href="/learning" icon={GraduationCap} title="Training due this week">
        <p className={`text-2xl font-semibold ${work.trainingsDue ? 'text-amber-600' : 'text-slate-900'}`}>{work.trainingsDue}</p>
        <p className="text-xs text-slate-500">Including overdue programmes</p>
      </Tile>
    </div>
  );
}
