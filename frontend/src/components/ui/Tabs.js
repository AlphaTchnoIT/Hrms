import clsx from 'clsx';

// tabs = [{ value: 'pending', label: 'Pending', count: 3 }]
export default function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={clsx('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1', className)}>
      {tabs.map((tab) => {
        const active = value === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={clsx(
              'inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  'rounded-full px-1.5 text-[11px] font-semibold',
                  active ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
