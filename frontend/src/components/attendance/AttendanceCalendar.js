import clsx from 'clsx';
import { formatTime, minutesToHours, titleCase } from '@/lib/format';

// UK calendars start the week on Monday
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Pill colour for each day status
const PILL = {
  present: 'bg-emerald-50 text-emerald-700',
  'half-day': 'bg-amber-50 text-amber-700',
  absent: 'bg-rose-50 text-rose-700',
  leave: 'bg-violet-50 text-violet-700',
  holiday: 'bg-sky-50 text-sky-700',
  'weekly-off': 'bg-slate-100 text-slate-500',
};

const LEGEND = [
  ['present', 'bg-emerald-500'],
  ['half-day', 'bg-amber-500'],
  ['absent', 'bg-rose-500'],
  ['leave', 'bg-violet-500'],
  ['holiday', 'bg-sky-500'],
  ['weekly-off', 'bg-slate-300'],
];

function getLabel(day) {
  if (day.status === 'holiday') return day.holiday;
  if (day.status === 'leave') return day.leave?.leaveType?.name || 'Leave';
  if (day.status === 'today') return day.record ? 'Checked in' : 'Today';
  if (['upcoming', 'not-employed'].includes(day.status)) return '';
  return titleCase(day.status);
}

/*
 * Month grid. `days` comes from GET /attendance/my
 * onDayClick(day) is optional (used to open the regularization form)
 */
export default function AttendanceCalendar({ days = [], onDayClick }) {
  if (!days.length) return null;
  const leadingBlanks = (new Date(`${days[0].date}T00:00:00`).getDay() + 6) % 7; // Monday = 0

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {WEEK_DAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}

        {days.map((day) => {
          const clickable = onDayClick && ['absent', 'half-day', 'present', 'today'].includes(day.status);
          const isToday = day.status === 'today';
          const muted = ['upcoming', 'not-employed'].includes(day.status);
          const label = getLabel(day);

          return (
            <button
              key={day.date}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onDayClick(day)}
              title={clickable ? 'Click to request regularisation' : label}
              className={clsx(
                'group flex min-h-[72px] flex-col rounded-xl border p-1.5 text-left transition sm:min-h-[92px] sm:p-2.5',
                isToday ? 'border-brand-400 bg-brand-50/40 ring-2 ring-brand-100' : 'border-slate-200 bg-white',
                day.status === 'weekly-off' && 'bg-slate-50',
                muted && 'opacity-50',
                clickable && 'hover:border-brand-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center justify-between">
                <span className={clsx('text-sm font-semibold', isToday ? 'text-brand-700' : 'text-slate-700')}>
                  {Number(day.date.slice(8))}
                </span>
                {day.record?.isLate && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" title="Late" />}
              </div>

              {day.record?.checkIn?.time && (
                <span className="mt-1 hidden truncate text-[11px] tabular-nums text-slate-500 sm:block">
                  {formatTime(day.record.checkIn.time)}
                  {day.record.checkOut?.time ? ` · ${minutesToHours(day.record.workMinutes)}` : ''}
                </span>
              )}

              {label && (
                <span
                  className={clsx(
                    'mt-auto truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:text-[11px]',
                    PILL[day.status] || 'bg-brand-50 text-brand-700'
                  )}
                >
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
        {LEGEND.map(([status, dot]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={clsx('h-2 w-2 rounded-full', dot)} /> {titleCase(status)}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> Late mark
        </span>
      </div>
    </div>
  );
}
