'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, LogIn, LogOut, MapPin, Timer } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { formatTime, minutesToHours } from '@/lib/format';
import { Badge, Button, Skeleton } from '@/components/ui';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { ATTENDANCE_UPDATED_EVENT } from '@/components/layout/AttendanceChip';

// Ask the browser for location; never blocks check-in if the user denies it
function getBrowserLocation() {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

function TimeBox({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

export default function CheckInCard({ onChange }) {
  const confirm = useConfirm();
  const { data, loading, refetch } = useFetch('/attendance/today');
  const [now, setNow] = useState(null);
  const [busy, setBusy] = useState(false);

  // Live clock (started after mount to avoid hydration mismatch)
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const record = data?.record;
  const checkedIn = Boolean(record?.checkIn?.time);
  const checkedOut = Boolean(record?.checkOut?.time);
  const workedMinutes = checkedOut
    ? record.workMinutes
    : checkedIn && now
      ? Math.max(0, Math.floor((now - new Date(record.checkIn.time)) / 60000))
      : 0;

  const punch = async (type) => {
    if (type === 'check-out') {
      const ok = await confirm({
        title: 'Check out now?',
        message: `You have worked ${minutesToHours(workedMinutes)} today. You can check out only once per day.`,
        confirmText: 'Check out',
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      const location = await getBrowserLocation();
      const res = await api.post(`/attendance/${type}`, location);
      toast.success(res.message);
      await refetch();
      window.dispatchEvent(new Event(ATTENDANCE_UPDATED_EVENT));
      onChange?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="card h-full space-y-4 p-5">
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
        <Skeleton className="h-11 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-600 p-5 text-white">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between gap-2">
          <p className="text-sm text-brand-100">
            {now?.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) || ' '}
          </p>
          {record?.isLate && (
            <Badge color="yellow" className="bg-amber-100">
              Late {record.lateByMinutes}m
            </Badge>
          )}
        </div>
        <p className="relative mt-1 text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
          {now?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) || '--:--'}
        </p>
        <p className="relative mt-2 flex items-center gap-1.5 text-xs text-brand-100">
          <Clock className="h-3.5 w-3.5" /> General shift · {data?.officeStartTime} – {data?.officeEndTime}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <TimeBox label="In" icon={LogIn} value={checkedIn ? formatTime(record.checkIn.time) : '--:--'} />
        <TimeBox label="Out" icon={LogOut} value={checkedOut ? formatTime(record.checkOut.time) : '--:--'} />
        <TimeBox label="Worked" icon={Timer} value={minutesToHours(workedMinutes)} />
      </div>

      <div className="mt-auto pt-4">
        {!checkedIn && (
          <Button className="w-full" size="lg" icon={LogIn} loading={busy} onClick={() => punch('check-in')}>
            Web Check-in
          </Button>
        )}
        {checkedIn && !checkedOut && (
          <Button className="w-full" size="lg" variant="danger" icon={LogOut} loading={busy} onClick={() => punch('check-out')}>
            Web Check-out
          </Button>
        )}
        {checkedOut && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            Done for today · <Badge status={record.status} />
          </div>
        )}
        {data?.requireLocation && (
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3" /> Location access is required for check-in
          </p>
        )}
      </div>
    </div>
  );
}
