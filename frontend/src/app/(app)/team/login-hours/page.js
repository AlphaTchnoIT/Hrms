'use client';

import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { formatDay, formatTime, getFullName, minutesToHours, toInputDate } from '@/lib/format';
import { Badge, Button, Card, DataTable, ErrorMessage, Input, Modal, PageHeader } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';
import { useTeamScope } from '@/hooks/useTeamScope';
import TeamScopeToggle from '@/components/shared/TeamScopeToggle';

const yesterday = () => toInputDate(new Date(Date.now() - 86400000));

function EditHours({ row, day, onClose, onSaved }) {
  const [productive, setProductive] = useState(day.productiveMinutes ?? Math.max(0, day.loginMinutes - 60));
  const [idle, setIdle] = useState(day.idleMinutes ?? 0);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/workforce/login-hours', { user: row.user._id, date: day.date, productiveMinutes: Number(productive), idleMinutes: Number(idle) });
      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Productive (AT) & idle time"
      description={`${getFullName(row.user)} · ${formatDay(day.date)} · login ${minutesToHours(day.loginMinutes)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Productive minutes" type="number" min="0" value={productive} onChange={(e) => setProductive(e.target.value)} hint={minutesToHours(Number(productive))} />
        <Input label="Idle minutes" type="number" min="0" value={idle} onChange={(e) => setIdle(e.target.value)} hint={minutesToHours(Number(idle))} />
      </div>
    </Modal>
  );
}

export default function LoginHoursPage() {
  const [from, setFrom] = useState(yesterday());
  const [to, setTo] = useState(yesterday());
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const teamScope = useTeamScope();
  const { data, loading, error, refetch } = useFetch('/workforce/login-hours', { params: { from, to, scope: teamScope.scope } });
  const rows = data?.rows || [];

  const pctTone = (v) => (v === null ? '' : v >= 90 ? 'text-emerald-600' : v >= 80 ? 'text-amber-600' : 'text-rose-600');

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => <EmployeeCell employee={r.user} /> },
    { key: 'days', header: 'Working days', render: (r) => r.summary.scheduledDays },
    { key: 'scheduled', header: 'Scheduled', render: (r) => minutesToHours(r.summary.scheduledMinutes) },
    { key: 'login', header: 'Login hrs', render: (r) => minutesToHours(r.summary.loginMinutes) },
    { key: 'at', header: 'AT hrs', render: (r) => minutesToHours(r.summary.productiveMinutes) },
    { key: 'idle', header: 'Idle', render: (r) => <span className={clsx(r.summary.idleDays && 'font-semibold text-rose-600')}>{minutesToHours(r.summary.idleMinutes)}</span> },
    { key: 'late', header: 'Late', render: (r) => r.summary.lateLogins || '—' },
    { key: 'short', header: 'Short', render: (r) => r.summary.shortLogins || '—' },
    { key: 'absent', header: 'Absent', render: (r) => r.summary.absent || '—' },
    { key: 'adherence', header: 'Adherence', render: (r) => <span className={clsx('font-semibold', pctTone(r.summary.adherencePercent))}>{r.summary.adherencePercent ?? '—'}%</span> },
    // Minutes logged in inside the scheduled shift / scheduled minutes
    { key: 'scheduleAdherence', header: 'Schedule adh.', render: (r) => <span className={clsx('font-semibold', pctTone(r.summary.scheduleAdherencePercent))}>{r.summary.scheduleAdherencePercent ?? '—'}%</span> },
    { key: 'view', header: '', render: (r) => <Button size="xs" variant="secondary" onClick={() => setSelected(r)}>Days</Button> },
  ];

  const exportCsv = () =>
    downloadCsv(
      `login-hours-${from}-to-${to}.csv`,
      [
        { header: 'Employee', value: (r) => getFullName(r.user) },
        { header: 'Code', value: (r) => r.user.employeeCode },
        { header: 'Working days', value: (r) => r.summary.scheduledDays },
        { header: 'Scheduled hrs', value: (r) => (r.summary.scheduledMinutes / 60).toFixed(1) },
        { header: 'Login hrs', value: (r) => (r.summary.loginMinutes / 60).toFixed(1) },
        { header: 'AT hrs', value: (r) => (r.summary.productiveMinutes / 60).toFixed(1) },
        { header: 'Idle hrs', value: (r) => (r.summary.idleMinutes / 60).toFixed(1) },
        { header: 'Late logins', value: (r) => r.summary.lateLogins },
        { header: 'Short logins', value: (r) => r.summary.shortLogins },
        { header: 'Absent', value: (r) => r.summary.absent },
        { header: 'Adherence %', value: (r) => r.summary.adherencePercent ?? '' },
        { header: 'In-shift hrs', value: (r) => (r.summary.adherentMinutes / 60).toFixed(1) },
        { header: 'Schedule adherence %', value: (r) => r.summary.scheduleAdherencePercent ?? '' },
      ],
      rows
    );

  const current = selected && rows.find((r) => r.user._id === selected.user._id);

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Login / AT Hours"
        subtitle={`Daily login and productive hours. Short login < ${data?.shortLoginPercent ?? 90}% of shift, idle alert > ${data?.idleAlertMinutes ?? 60} min.`}
        actions={
          <Button variant="secondary" icon={Download} disabled={!rows.length} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input label="From" type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input label="To" type="date" className="w-44" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        <div className="self-end">
          <TeamScopeToggle {...teamScope} />
        </div>
      </div>
      <ErrorMessage message={error} onRetry={refetch} />
      <Card noPadding>
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r) => r.user._id} emptyMessage="No team members" />
      </Card>

      <Modal open={Boolean(current)} onClose={() => setSelected(null)} size="xl" title={current ? getFullName(current.user) : ''} description={`${from} → ${to}`}>
        {current && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Shift</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">In / out</th>
                  <th className="py-2 pr-3">Login</th>
                  <th className="py-2 pr-3">In shift</th>
                  <th className="py-2 pr-3">AT</th>
                  <th className="py-2 pr-3">Idle</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {current.days.map((d) => (
                  <tr key={d.date}>
                    <td className="whitespace-nowrap py-2 pr-3">{formatDay(d.date)}</td>
                    <td className="whitespace-nowrap py-2 pr-3">{d.shift.isWeeklyOff ? 'Off' : `${d.shift.startTime}–${d.shift.endTime}`}</td>
                    <td className="py-2 pr-3">
                      <Badge status={d.status} />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3">{d.checkIn ? `${formatTime(d.checkIn)} – ${d.checkOut ? formatTime(d.checkOut) : '…'}` : '—'}</td>
                    <td className="py-2 pr-3">{d.loginMinutes ? minutesToHours(d.loginMinutes) : '—'}</td>
                    <td className="py-2 pr-3">{d.adherentMinutes ? minutesToHours(d.adherentMinutes) : '—'}</td>
                    <td className="py-2 pr-3">{d.productiveMinutes !== null ? minutesToHours(d.productiveMinutes) : '—'}</td>
                    <td className={clsx('py-2 pr-3', d.isIdle && 'font-semibold text-rose-600')}>{d.idleMinutes !== null ? minutesToHours(d.idleMinutes) : '—'}</td>
                    <td className="py-2">
                      {d.attendanceId && (
                        <Button size="xs" variant="ghost" onClick={() => setEditing({ row: current, day: d })}>
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
      {editing && <EditHours row={editing.row} day={editing.day} onClose={() => setEditing(null)} onSaved={refetch} />}
    </RoleGuard>
  );
}
