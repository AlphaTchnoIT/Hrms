import clsx from 'clsx';
import { minutesToHours } from '@/lib/format';

const ITEMS = [
  { key: 'present', label: 'Present', dot: 'bg-emerald-500' },
  { key: 'halfDay', label: 'Half day', dot: 'bg-amber-500' },
  { key: 'absent', label: 'Absent', dot: 'bg-rose-500' },
  { key: 'leave', label: 'On leave', dot: 'bg-violet-500' },
  { key: 'late', label: 'Late marks', dot: 'bg-orange-500' },
  { key: 'holidays', label: 'Holidays', dot: 'bg-sky-500' },
];

// Month summary as one card: big "hours worked" + small counters
export default function AttendanceSummary({ summary, className }) {
  if (!summary) return null;
  const workingDays = summary.present + summary.halfDay + summary.absent + summary.leave;
  const attendancePct = workingDays ? Math.round(((summary.present + summary.halfDay * 0.5) / workingDays) * 100) : 0;
  const avgMinutes = summary.present + summary.halfDay ? summary.totalWorkMinutes / (summary.present + summary.halfDay) : 0;

  return (
    <div className={clsx('card h-full p-5', className)}>
      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <p className="text-[13px] font-medium text-slate-500">Total hours</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">{minutesToHours(summary.totalWorkMinutes)}</p>
          <p className="mt-1 text-xs text-slate-500">Avg {minutesToHours(Math.round(avgMinutes))} / day</p>
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-slate-500">Attendance this month</span>
            <span className="font-semibold text-slate-900">{attendancePct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${attendancePct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {ITEMS.map((item) => (
              <div key={item.key}>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={clsx('h-2 w-2 rounded-full', item.dot)} /> {item.label}
                </p>
                <p className="mt-0.5 text-lg font-semibold text-slate-900">{summary[item.key]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
