'use client';

import { useState } from 'react';
import { CalendarX2, Clock, MapPin, UserCheck, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { formatTime, minutesToHours, toInputDate } from '@/lib/format';
import { Badge, Card, DataTable, ErrorMessage, Input, PageHeader, Select, StatCard } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';

function LocationLink({ punch }) {
  const loc = punch?.location;
  if (!loc?.latitude) return null;
  return (
    <a
      href={`https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`}
      target="_blank"
      rel="noreferrer"
      className="ml-1 inline-flex text-brand-600"
      title="View location"
    >
      <MapPin className="h-3.5 w-3.5" />
    </a>
  );
}

export default function TeamAttendancePage() {
  const { isHR } = useAuth();
  const [date, setDate] = useState(toInputDate());
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');

  const departments = useFetch(isHR ? '/departments' : null);
  const { data, loading, error, refetch } = useFetch('/attendance/daily', {
    params: { date, department: department || undefined, status: status || undefined },
  });

  const summary = data?.summary;

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => <EmployeeCell employee={r.employee} href={`/employees/${r.employee._id}`} /> },
    { key: 'department', header: 'Department', render: (r) => r.employee.department?.name || '—' },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'in',
      header: 'Check in',
      render: (r) =>
        r.record?.checkIn?.time ? (
          <span className="inline-flex items-center">
            {formatTime(r.record.checkIn.time)}
            <LocationLink punch={r.record.checkIn} />
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'out',
      header: 'Check out',
      render: (r) =>
        r.record?.checkOut?.time ? (
          <span className="inline-flex items-center">
            {formatTime(r.record.checkOut.time)}
            <LocationLink punch={r.record.checkOut} />
          </span>
        ) : (
          '—'
        ),
    },
    { key: 'hours', header: 'Hours', render: (r) => (r.record?.checkOut?.time ? minutesToHours(r.record.workMinutes) : '—') },
    {
      key: 'late',
      header: 'Late',
      render: (r) => (r.record?.isLate ? <span className="text-amber-600">{r.record.lateByMinutes} min</span> : '—'),
    },
    { key: 'leave', header: 'Leave', render: (r) => r.leave?.leaveType?.name || '—' },
  ];

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Team Attendance"
        subtitle="Who checked in on a given day"
        actions={<Input type="date" value={date} max={toInputDate()} onChange={(e) => setDate(e.target.value)} />}
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total" value={summary.total} icon={Users} />
          <StatCard label="Checked in" value={summary.checkedIn} icon={UserCheck} tone="green" hint={`${summary.late} late`} />
          <StatCard label="On leave" value={summary.onLeave} icon={CalendarX2} tone="purple" />
          <StatCard label="Not checked in" value={summary.notCheckedIn} icon={Clock} tone="red" />
        </div>
      )}

      <Card noPadding>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          {isHR && (
            <Select
              className="w-48"
              placeholder="All departments"
              options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          )}
          <Select
            className="w-48"
            placeholder="All statuses"
            options={['checked-in', 'present', 'half-day', 'absent', 'on-leave', 'not-checked-in']}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        </div>
        {error && (
          <div className="p-4">
            <ErrorMessage message={error} onRetry={refetch} />
          </div>
        )}
        <DataTable columns={columns} rows={data?.rows} loading={loading} rowKey={(r) => r.employee._id} />
      </Card>
    </RoleGuard>
  );
}
