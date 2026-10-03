'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Bell } from 'lucide-react';
import api from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const POLL_INTERVAL = 60 * 1000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);

  const load = async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.data.items);
      setUnreadCount(res.data.unreadCount);
    } catch {
      /* not critical */
    }
  };

  // Load now and refresh every minute
  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    load();
  };

  const openItem = async (item) => {
    setOpen(false);
    if (!item.isRead) {
      await api.patch(`/notifications/${item._id}/read`);
      load();
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="font-semibold text-slate-800">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!items.length && <p className="px-4 py-8 text-center text-sm text-slate-500">You&apos;re all caught up</p>}
            {items.map((item) => (
              <Link
                key={item._id}
                href={item.link || '#'}
                onClick={() => openItem(item)}
                className={clsx('block border-b border-slate-50 px-4 py-3 hover:bg-slate-50', !item.isRead && 'bg-brand-50/50')}
              >
                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                {item.message && <p className="mt-0.5 text-xs text-slate-600">{item.message}</p>}
                <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.createdAt)}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
