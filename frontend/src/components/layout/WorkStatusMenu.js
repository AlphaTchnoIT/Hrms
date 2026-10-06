'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Check, ChevronDown, Clock, MessageSquareText } from 'lucide-react';
import api from '@/lib/api';
import { WORK_CATEGORIES, WORK_CATEGORY_KEYS, WORK_STATUS_UPDATED_EVENT, formatMinutes, minutesSince } from '@/lib/workStatus';
import { ATTENDANCE_UPDATED_EVENT } from './AttendanceChip';

/*
 * Live Work Status picker in the top bar ("● Email handling · 25m").
 * Employees can change it between check-in and check-out; their TL, managers and HR see it live.
 */
export default function WorkStatusMenu() {
  const [me, setMe] = useState(null);
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(null);
  const [, setTick] = useState(0);
  const ref = useRef(null);

  const load = useCallback(() => {
    api
      .get('/work-status/me')
      .then((res) => setMe(res.data))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    load();
    api
      .get('/work-status/options')
      .then((res) => setOptions(res.data.statuses))
      .catch(() => setOptions([]));
    window.addEventListener(ATTENDANCE_UPDATED_EVENT, load);
    // Keep the "for 25m" timer moving and pick up check-outs from other tabs
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    const refresh = setInterval(load, 5 * 60000);
    return () => {
      window.removeEventListener(ATTENDANCE_UPDATED_EVENT, load);
      clearInterval(timer);
      clearInterval(refresh);
    };
  }, [load]);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    if (open) setNote(me?.current?.note || '');
  }, [open, me]);

  if (!me) return null;

  const current = me.current;
  const meta = WORK_CATEGORIES[current?.category || 'offline'];
  const canSet = me.checkedIn && !me.checkedOut;

  const choose = async (status) => {
    setSaving(status.key);
    try {
      const res = await api.post('/work-status', { status: status.key, note: note.trim() });
      toast.success(res.message);
      setOpen(false);
      load();
      window.dispatchEvent(new Event(WORK_STATUS_UPDATED_EVENT));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(null);
    }
  };

  const grouped = WORK_CATEGORY_KEYS.map((key) => ({ key, items: options.filter((s) => s.category === key) })).filter((g) => g.items.length);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-2.5 pr-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        aria-label="Change work status"
        aria-expanded={open}
      >
        <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', meta.dot)} />
        <span className="max-w-[9rem] truncate">{current?.label || 'Offline'}</span>
        {current && <span className="hidden tabular-nums text-slate-400 md:inline">· {formatMinutes(minutesSince(current.since))}</span>}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] animate-scale-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-800">Live Work Status</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Today: {formatMinutes(me.summary.categories.productive)} productive · {formatMinutes(me.summary.categories.break)} break
            </p>
          </div>

          {!canSet ? (
            <div className="px-4 py-5 text-center text-sm text-slate-500">
              {me.checkedOut ? 'You have checked out for today.' : 'Check in to start setting your status.'}
              {!me.checkedIn && (
                <Link href="/attendance" onClick={() => setOpen(false)} className="mt-2 block font-medium text-brand-600 hover:underline">
                  Go to attendance
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-3 py-2.5">
                <label className="relative block">
                  <MessageSquareText className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    className="form-control pl-8 text-sm"
                    placeholder="What are you working on? (optional)"
                    maxLength={120}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
              </div>
              <div className="max-h-80 overflow-y-auto p-1.5">
                {grouped.map((group) => (
                  <div key={group.key} className="mb-1">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{WORK_CATEGORIES[group.key].label}</p>
                    {group.items.map((status) => {
                      const selected = current?.status === status.key;
                      return (
                        <button
                          key={status.key}
                          onClick={() => choose(status)}
                          disabled={Boolean(saving)}
                          className={clsx(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-60',
                            selected && 'bg-slate-50 font-medium'
                          )}
                        >
                          <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', WORK_CATEGORIES[status.category].dot)} />
                          <span className="flex-1 text-slate-700">{status.label}</span>
                          {saving === status.key ? <span className="text-xs text-slate-400">Saving…</span> : selected && <Check className="h-4 w-4 text-brand-600" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}

          <Link href="/my-status" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            View my day
          </Link>
          <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] leading-snug text-slate-500">
            Your status and its times are visible to your team lead, managers and HR. Colleagues only see available / busy / away.
          </p>
        </div>
      )}
    </div>
  );
}
