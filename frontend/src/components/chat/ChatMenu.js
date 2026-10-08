'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { MoreHorizontal } from 'lucide-react';

/*
 * Small "⋯" menu. items = [{ label, icon, onClick, danger, checked, disabled } | { heading } | { divider: true }]
 */
export default function ChatMenu({ items, label = 'More options', className, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    // "relative" only when the caller doesn't position it (absolute + relative together would let relative win)
    <div ref={ref} className={clsx(!/\b(absolute|fixed)\b/.test(className || '') && 'relative', className)}>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute top-full z-30 mt-1 max-h-80 w-56 animate-scale-in overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-pop',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, i) => {
            if (item.divider) return <div key={`d${i}`} className="my-1 h-px bg-slate-100" />;
            if (item.heading) {
              return (
                <p key={`h${i}`} className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {item.heading}
                </p>
              );
            }
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={clsx(
                  'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40',
                  item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50',
                  item.checked && 'font-semibold text-brand-700'
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.checked && <span className="text-brand-600">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
