import clsx from 'clsx';
import { WORK_CATEGORIES } from '@/lib/workStatus';

// Coloured "● Email handling" pill for a status (or "Offline" when there is none)
export default function StatusPill({ current, className }) {
  const meta = WORK_CATEGORIES[current?.category || 'offline'];
  return (
    <span className={clsx('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', meta.soft, className)}>
      <span className={clsx('h-2 w-2 shrink-0 rounded-full', meta.dot)} />
      <span className="truncate">{current?.label || 'Offline'}</span>
    </span>
  );
}
