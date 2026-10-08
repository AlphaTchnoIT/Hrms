'use client';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Check, CircleAlert, MessageSquare, Siren } from 'lucide-react';
import { CHAT_PRIORITIES } from './chatUtils';

const ICONS = { standard: MessageSquare, important: CircleAlert, urgent: Siren };

// Delivery options for the next message: Standard / Important / Urgent (like Teams)
export default function PriorityMenu({ value, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} role="menu" aria-label="Delivery options" className="absolute bottom-full left-10 z-20 mb-2 w-72 animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
      <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Delivery options</p>
      {Object.entries(CHAT_PRIORITIES).map(([key, { label, hint }]) => {
        const Icon = ICONS[key];
        return (
          <button
            key={key}
            type="button"
            role="menuitemradio"
            aria-checked={value === key}
            onClick={() => onPick(key)}
            className={clsx('flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50', value === key && 'bg-slate-50')}
          >
            <Icon className={clsx('h-5 w-5 shrink-0', key === 'standard' ? 'text-slate-500' : 'text-red-600')} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-slate-800">{label}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </span>
            {value === key && <Check className="h-4 w-4 text-brand-600" />}
          </button>
        );
      })}
    </div>
  );
}
