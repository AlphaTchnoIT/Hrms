'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { Briefcase, ExternalLink, LogOut, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { openApp } from '@/lib/apps';
import { getNavigationForRole, isNavItemActive } from '@/lib/navigation';
import { Avatar } from '@/components/ui';

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const { user, logout, accessRoles, features } = useAuth();
  const sections = getNavigationForRole(accessRoles, features);

  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 animate-fade-in bg-slate-900/40 lg:hidden" onClick={onClose} />}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0 shadow-pop' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm">
              <Briefcase className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-[15px] font-bold leading-tight tracking-tight text-slate-900">PeopleHub</span>
              <span className="block text-[11px] leading-tight text-slate-500">HR made simple</span>
            </span>
          </Link>
          <button onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {sections.map((section, index) => (
            <div key={section.title || index}>
              {section.title && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
              )}
              <ul className="space-y-0.5">
                {section.items.map(({ href, label, icon: Icon, app }) => {
                  const active = isNavItemActive(pathname, href);
                  // Another app (Chat): open / bring back its own tab
                  if (app) {
                    return (
                      <li key={href}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            openApp(app);
                          }}
                          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          <Icon className="h-[18px] w-[18px] shrink-0 text-slate-400 group-hover:text-slate-600" />
                          {label}
                          <ExternalLink className="ml-auto h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" />
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onClose}
                        className={clsx(
                          'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                          active
                            ? 'bg-brand-50 font-semibold text-brand-700'
                            : 'font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        )}
                      >
                        {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-600" />}
                        <Icon className={clsx('h-[18px] w-[18px] shrink-0', active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600')} />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar name={user?.fullName} src={user?.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user?.designation?.title || user?.email}</p>
            </div>
            <button onClick={logout} aria-label="Logout" title="Logout" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
