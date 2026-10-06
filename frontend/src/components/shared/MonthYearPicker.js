import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MONTHS, zonedParts } from '@/lib/format';

// Month navigator: ‹ September 2026 ›   (month is 1-12)
export default function MonthYearPicker({ month, year, onChange, disableFuture = true }) {
  const now = zonedParts();
  const isCurrentOrFuture = year > now.year || (year === now.year && month >= now.month);

  const go = (delta) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    onChange({ month: m, year: y });
  };

  return (
    <div className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white shadow-sm">
      <button onClick={() => go(-1)} className="flex h-full items-center rounded-l-lg px-2.5 text-slate-500 hover:bg-slate-50">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-36 px-2 text-center text-sm font-medium text-slate-700">
        {MONTHS[month - 1]} {year}
      </span>
      <button
        onClick={() => go(1)}
        disabled={disableFuture && isCurrentOrFuture}
        className="flex h-full items-center rounded-r-lg px-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
