import clsx from 'clsx';
import { STATUS_COLORS } from '@/lib/constants';
import { titleCase } from '@/lib/format';

const COLORS = {
  gray: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-rose-50 text-rose-700',
  yellow: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
  purple: 'bg-violet-50 text-violet-700',
};

const DOTS = {
  gray: 'bg-slate-400',
  green: 'bg-emerald-500',
  red: 'bg-rose-500',
  yellow: 'bg-amber-500',
  blue: 'bg-sky-500',
  purple: 'bg-violet-500',
};

const LABELS = { hr: 'HR', qa: 'QA', it: 'IT' };

// <Badge status="approved" /> picks the colour automatically, or pass color + children
export default function Badge({ status, color, children, className, dot = true }) {
  const resolvedColor = color || STATUS_COLORS[status] || 'gray';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        COLORS[resolvedColor],
        className
      )}
    >
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOTS[resolvedColor])} />}
      {children || LABELS[status] || titleCase(status)}
    </span>
  );
}
