'use client';

import clsx from 'clsx';
import { Briefcase, MessageSquare } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { APPS, openApp } from '@/lib/apps';

const ICONS = { hrms: Briefcase, chat: MessageSquare };

// [ HRMS | Chat ] in the top bar of both apps. The other app opens in its own tab.
export default function AppSwitcher({ current }) {
  const { features } = useAuth();
  const { unreadTotal } = useChat();
  if (!features.chat) return null;

  return (
    <div className="flex items-center rounded-full bg-slate-100 p-0.5" role="group" aria-label="Switch app">
      {Object.entries(APPS).map(([app, { label }]) => {
        const Icon = ICONS[app];
        const active = app === current;
        const badge = app === 'chat' && !active && unreadTotal > 0;
        return (
          <button
            key={app}
            type="button"
            onClick={() => !active && openApp(app)}
            aria-current={active ? 'page' : undefined}
            title={active ? label : `Open ${label} in its own tab`}
            className={clsx(
              'relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition',
              active ? 'cursor-default bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
            {badge && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadTotal > 9 ? '9+' : unreadTotal}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
