'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Lock } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { getFullName, minutesToHours, MONTHS } from '@/lib/format';
import { Button, Card, DataTable, ErrorMessage, Input, Modal, PageHeader } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';
import { useTeamScope } from '@/hooks/useTeamScope';
import TeamScopeToggle from '@/components/shared/TeamScopeToggle';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const hoursOf = (minutes) => Math.round(((minutes || 0) / 60) * 100) / 100;

function EditMonthlyHours({ row, month, year, onClose, onSaved }) {
  const [hours, setHours] = useState(row.monthlyMinutes !== null ? hoursOf(row.monthlyMinutes) : hoursOf(row.dailyProductiveMinutes || row.loginMinutes));
  const [note, setNote] = useState(row.note);
  const [saving, setSaving] = useState(false);

  const save = async (value) => {
    if (value !== null && (String(hours).trim() === '' || Number.isNaN(Number(hours)))) {
      toast.error('Enter the AT hours, or use Clear to remove the entry');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/workforce/monthly-hours', { user: row.user._id, month, year, hours: value, note });
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
      title="Monthly AT hours"
      description={`${getFullName(row.user)} · ${MONTHS[month - 1]} ${year} · login ${minutesToHours(row.loginMinutes)}`}
      footer={
        <>
          {row.monthlyMinutes !== null && (
            <Button variant="ghost" className="mr-auto" disabled={saving} onClick={() => save(null)}>
              Clear
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={() => save(Number(hours))}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="AT hours this month" type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} hint="Hourly pay = hourly rate x these hours" />
        <Input label="Note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

// One AT hours number per employee per month (instead of filling every day); hourly payroll uses it
export default function MonthlyHoursPage() {
  const [period, setPeriod] = useState(thisMonth());
  const [editing, setEditing] = useState(null);
  const teamScope = useTeamScope();
  const [year, month] = period.split('-').map(Number);
  const { data, loading, error, refetch } = useFetch('/workforce/monthly-hours', { params: { month, year, scope: teamScope.scope } });
  const rows = data?.rows || [];
  const locked = data?.locked;

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => <EmployeeCell employee={r.user} /> },
    { key: 'login', header: 'Login hrs', render: (r) => minutesToHours(r.loginMinutes) },
    { key: 'daily', header: 'Daily AT total', render: (r) => (r.dailyProductiveMinutes ? minutesToHours(r.dailyProductiveMinutes) : '—') },
    {
      key: 'monthly',
      header: 'Monthly AT hrs',
      render: (r) => (r.monthlyMinutes !== null ? <strong>{hoursOf(r.monthlyMinutes)}</strong> : <span className="text-slate-400">Not entered</span>),
    },
    { key: 'note', header: 'Note', render: (r) => r.note || '—' },
    { key: 'by', header: 'Entered by', render: (r) => (r.enteredBy ? getFullName(r.enteredBy) : '—') },
    {
      key: 'actions',
      header: '',
      render: (r) => {
        if (!r.hourly) return <span className="text-xs text-slate-400">Salaried</span>;
        if (locked) return null;
        return (
          <Button size="xs" variant="ghost" onClick={() => setEditing(r)}>
            {r.monthlyMinutes !== null ? 'Edit' : 'Enter'}
          </Button>
        );
      },
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `monthly-at-hours-${period}.csv`,
      [
        { header: 'Code', value: (r) => r.user.employeeCode },
        { header: 'Name', value: (r) => getFullName(r.user) },
        { header: 'Login hrs', value: (r) => hoursOf(r.loginMinutes) },
        { header: 'Daily AT hrs', value: (r) => hoursOf(r.dailyProductiveMinutes) },
        { header: 'Monthly AT hrs', value: (r) => (r.monthlyMinutes !== null ? hoursOf(r.monthlyMinutes) : '') },
        { header: 'Note', value: (r) => r.note },
      ],
      rows
    );

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Monthly AT Hours"
        subtitle="Enter each person's AT (productive) hours once a month. Hourly payroll uses this number; if it is empty, the daily AT hours are added up."
        actions={
          <Button variant="secondary" icon={Download} disabled={!rows.length} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Input label="Month" type="month" className="w-44" value={period} max={thisMonth()} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
        <div className="self-end">
          <TeamScopeToggle {...teamScope} />
        </div>
      </div>
      {locked && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          <Lock className="h-4 w-4" /> Payroll for this month is paid, hours are locked.
        </p>
      )}
      {data?.needsRerun && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Hours changed after this month&apos;s payroll was processed. HR needs to re-run payroll before paying.</p>
      )}
      <ErrorMessage message={error} onRetry={refetch} />
      <Card noPadding>
        <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r) => r.user._id} emptyMessage="No team members" />
      </Card>
      {editing && <EditMonthlyHours row={editing} month={month} year={year} onClose={() => setEditing(null)} onSaved={refetch} />}
    </RoleGuard>
  );
}
