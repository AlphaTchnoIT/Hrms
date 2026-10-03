'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import api from '@/lib/api';
import { formatTime } from '@/lib/format';

export const ATTENDANCE_UPDATED_EVENT = 'attendance-updated';

// Small "Checked in at 09:31" pill in the top bar. Refreshes when attendance changes.
export default function AttendanceChip() {
  const pathname = usePathname();
  const [record, setRecord] = useState(undefined);

  useEffect(() => {
    const load = () =>
      api
        .get('/attendance/today')
        .then((res) => setRecord(res.data.record))
        .catch(() => setRecord(null));
    load();
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, load);
    return () => window.removeEventListener(ATTENDANCE_UPDATED_EVENT, load);
  }, [pathname]);

  if (record === undefined) return null;

  const checkedIn = record?.checkIn?.time;
  const checkedOut = record?.checkOut?.time;

  const { text, tone } = checkedOut
    ? { text: `Checked out · ${formatTime(record.checkOut.time)}`, tone: 'slate' }
    : checkedIn
      ? { text: `Checked in · ${formatTime(record.checkIn.time)}`, tone: 'green' }
      : { text: 'Not checked in', tone: 'amber' };

  return (
    <Link
      href="/attendance"
      className={clsx(
        'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition sm:inline-flex',
        tone === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
        tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
        tone === 'slate' && 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
      )}
    >
      <span className="relative flex h-2 w-2">
        {tone === 'green' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span
          className={clsx(
            'relative inline-flex h-2 w-2 rounded-full',
            tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-400'
          )}
        />
      </span>
      {text}
    </Link>
  );
}
