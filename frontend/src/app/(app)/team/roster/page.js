'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { CalendarPlus, Eraser } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES, SHIFT_PRESETS, WEEK_DAYS } from '@/lib/constants';
import { formatDate, getFullName, toInputDate } from '@/lib/format';
import { Avatar, Button, Card, Checkbox, ErrorMessage, Input, Modal, PageHeader, PageLoader } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';

const CELL = {
  'weekly-off': 'bg-slate-100 text-slate-500',
  holiday: 'bg-sky-100 text-sky-700',
  'sick-leave': 'bg-violet-100 text-violet-700',
  'emergency-leave': 'bg-violet-100 text-violet-700',
  'approved-leave': 'bg-violet-100 text-violet-700',
  absent: 'bg-rose-100 text-rose-700',
  'late-login': 'bg-amber-100 text-amber-800',
  'short-login': 'bg-amber-100 text-amber-800',
  present: 'bg-emerald-50 text-emerald-700',
};
const SHORT = { 'weekly-off': 'OFF', holiday: 'HOL', 'sick-leave': 'SL', 'emergency-leave': 'EML', 'approved-leave': 'LV', absent: 'ABS' };

function AssignModal({ open, onClose, members, onSaved }) {
  const blank = () => ({ users: [], from: toInputDate(), to: toInputDate(new Date(Date.now() + 13 * 86400000)), ...SHIFT_PRESETS[1], weeklyOffDays: [0, 6], notes: '' });
  const [values, setValues] = useState(blank);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValues(blank());
      setErrors({});
    }
  }, [open]);

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));
  const toggle = (key, item) => set(key, values[key].includes(item) ? values[key].filter((x) => x !== item) : [...values[key], item]);

  const save = async (clear = false) => {
    setSaving(true);
    try {
      const res = clear
        ? await api.post('/workforce/roster/clear', { users: values.users, from: values.from, to: values.to })
        : await api.post('/workforce/roster/bulk', values);
      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Assign shifts"
      description="Publish a shift pattern for one or more team members. Employees are notified."
      footer={
        <>
          <Button variant="danger-soft" icon={Eraser} disabled={saving} onClick={() => save(true)}>
            Clear roster
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => save(false)}>
            Publish roster
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="form-label">Employees</p>
          <div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
            {members.map((m) => (
              <Checkbox key={m._id} label={getFullName(m)} checked={values.users.includes(m._id)} onChange={() => toggle('users', m._id)} />
            ))}
          </div>
          <div className="mt-1 flex gap-3 text-xs">
            <button type="button" className="font-medium text-brand-600" onClick={() => set('users', members.map((m) => m._id))}>
              Select all
            </button>
            <button type="button" className="font-medium text-slate-500" onClick={() => set('users', [])}>
              Clear
            </button>
          </div>
          {errors.users && <p className="mt-1 text-xs font-medium text-red-600">{errors.users}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="From" type="date" value={values.from} onChange={(e) => set('from', e.target.value)} error={errors.from} />
          <Input label="To" type="date" value={values.to} onChange={(e) => set('to', e.target.value)} error={errors.to} />
        </div>
        <div>
          <p className="form-label">Shift</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {SHIFT_PRESETS.map((s) => (
              <button
                type="button"
                key={s.shiftName}
                onClick={() => setValues((v) => ({ ...v, ...s }))}
                className={clsx(
                  'rounded-lg border px-3 py-1.5 text-sm',
                  values.shiftName === s.shiftName ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'
                )}
              >
                {s.shiftName} {s.startTime}–{s.endTime}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Shift name" value={values.shiftName} onChange={(e) => set('shiftName', e.target.value)} error={errors.shiftName} />
            <Input label="Start" type="time" value={values.startTime} onChange={(e) => set('startTime', e.target.value)} error={errors.startTime} />
            <Input label="End" type="time" value={values.endTime} onChange={(e) => set('endTime', e.target.value)} error={errors.endTime} hint="Earlier than start = night shift" />
          </div>
        </div>
        <div>
          <p className="form-label">Weekly offs</p>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((day, index) => (
              <button
                type="button"
                key={day}
                onClick={() => toggle('weeklyOffDays', index)}
                className={clsx(
                  'h-9 rounded-lg border px-3 text-sm font-medium',
                  values.weeklyOffDays.includes(index) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600'
                )}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function TeamRosterPage() {
  const [from, setFrom] = useState(toInputDate());
  const [assignOpen, setAssignOpen] = useState(false);
  const to = toInputDate(new Date(new Date(from).getTime() + 13 * 86400000));
  const { data, loading, error, refetch } = useFetch('/workforce/roster', { params: { from, to } });

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Team Roster"
        subtitle="Shifts, weekly offs and scheduled hours for your team"
        actions={
          <Button icon={CalendarPlus} onClick={() => setAssignOpen(true)}>
            Assign shifts
          </Button>
        }
      />
      <div className="mb-4 flex items-end gap-3">
        <Input label="Starting" type="date" className="w-48" value={from} onChange={(e) => setFrom(e.target.value)} />
        <p className="pb-2 text-sm text-slate-500">Showing 14 days to {formatDate(to)}</p>
      </div>
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <Card noPadding>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-500">Employee</th>
                  {data.dates.map((d) => (
                    <th key={d} className="whitespace-nowrap px-2 py-3 text-center font-semibold text-slate-500">
                      {formatDate(d, { weekday: 'short' })}
                      <span className="block font-normal">{d.slice(8)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.members.map(({ user, days }) => (
                  <tr key={user._id}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={getFullName(user)} size="sm" />
                        <span className="font-medium text-slate-800">{getFullName(user)}</span>
                      </div>
                    </td>
                    {data.dates.map((date) => {
                      const d = days.find((x) => x.date === date);
                      if (!d) return <td key={date} className="px-1 py-2 text-center text-slate-300">—</td>;
                      return (
                        <td key={date} className="px-1 py-2">
                          <div
                            className={clsx('rounded-md px-1 py-1 text-center leading-tight', CELL[d.status] || 'bg-white text-slate-700 ring-1 ring-slate-200')}
                            title={`${d.shift.shiftName} ${d.shift.startTime}-${d.shift.endTime} · ${d.status}${d.shift.isDefault ? ' (default)' : ''}`}
                          >
                            {SHORT[d.status] || (
                              <>
                                <span className="block font-semibold">{d.shift.startTime}</span>
                                <span className="block text-[10px] opacity-75">{d.shift.endTime}</span>
                              </>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            <span>OFF = weekly off</span>
            <span>HOL = holiday</span>
            <span>SL / EML / LV = sick, emergency, other leave</span>
            <span className="text-amber-700">Amber = late / short login</span>
            <span className="text-rose-700">ABS = absent</span>
          </div>
        </Card>
      )}
      <AssignModal open={assignOpen} onClose={() => setAssignOpen(false)} members={(data?.members || []).map((m) => m.user)} onSaved={refetch} />
    </RoleGuard>
  );
}
