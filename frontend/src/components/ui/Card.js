import clsx from 'clsx';

export default function Card({ title, subtitle, action, icon: Icon, children, className, bodyClassName, noPadding = false }) {
  return (
    <div className={clsx('card flex flex-col', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="truncate text-[15px] font-semibold text-slate-900">{title}</h3>}
              {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={clsx('flex-1', !noPadding && 'p-5', bodyClassName)}>{children}</div>
    </div>
  );
}
