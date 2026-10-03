import clsx from 'clsx';
import { CheckCircle2, Circle } from 'lucide-react';
import { APPLICATION_STATUS } from '@/lib/constants';
import { titleCase } from '@/lib/format';
import { Badge } from '@/components/ui';

const PIPELINE = APPLICATION_STATUS.filter((s) => s !== 'rejected');

// Application journey shown to applicants: Received -> ... -> Onboarding
export default function StatusTracker({ status }) {
  if (status === 'rejected') return <Badge status="rejected">Not selected</Badge>;
  const index = PIPELINE.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-xs">
      {PIPELINE.map((s, i) => (
        <li key={s} className={clsx('flex items-center gap-1 rounded-full px-2 py-1', i <= index ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-400')}>
          {i <= index ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
          {titleCase(s)}
        </li>
      ))}
    </ol>
  );
}
