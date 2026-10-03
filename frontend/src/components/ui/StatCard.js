import Link from 'next/link';
import clsx from 'clsx';

const TONES = {
  brand: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-rose-50 text-rose-600',
  yellow: 'bg-amber-50 text-amber-600',
  blue: 'bg-sky-50 text-sky-600',
  purple: 'bg-violet-50 text-violet-600',
  gray: 'bg-slate-100 text-slate-600',
};

export default function StatCard({ label, value, icon: Icon, tone = 'brand', hint, href }) {
  const content = (
    <div className={clsx('card flex h-full items-start justify-between gap-3 p-5', href && 'transition hover:border-brand-200 hover:shadow-md')}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}
