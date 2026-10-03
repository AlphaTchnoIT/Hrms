'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight, KeyRound, LogOut, Menu, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { findNavItem } from '@/lib/navigation';
import { Avatar, Badge } from '@/components/ui';
import NotificationBell from './NotificationBell';
import AttendanceChip from './AttendanceChip';

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-slate-100"
        aria-label="Account menu"
      >
        <Avatar name={user?.fullName} src={user?.avatar} size="sm" />
        <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <Avatar name={user?.fullName} src={user?.avatar} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">{user?.fullName}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
              <Badge status={user?.role} className="mt-1" />
            </div>
          </div>
          <div className="p-1.5">
            {[
              { href: '/profile', label: 'My profile', icon: UserRound },
              { href: '/profile?tab=security', label: 'Change password', icon: KeyRound },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 text-slate-400" /> {label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ onMenuClick }) {
  const pathname = usePathname();
  const { section, item } = findNavItem(pathname);

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md sm:px-6">
      <button onClick={onMenuClick} aria-label="Open menu" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb */}
      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        {section?.title && (
          <>
            <span className="hidden text-slate-400 sm:inline">{section.title}</span>
            <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:inline" />
          </>
        )}
        <span className="truncate font-medium text-slate-800">{item?.label || 'PeopleHub'}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <AttendanceChip />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
