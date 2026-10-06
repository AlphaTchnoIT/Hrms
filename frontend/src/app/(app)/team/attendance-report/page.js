'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { getFullName, MONTHS, minutesToHours, zonedParts } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { Button, Card, DataTable, ErrorMessage, PageHeader, Select } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import MonthYearPicker from '@/components/shared/MonthYearPicker';
import RoleGuard from '@/components/layout/RoleGuard';
import { useTeamScope } from '@/hooks/useTeamScope';
import TeamScopeToggle from '@/components/shared/TeamScopeToggle';

export default function AttendanceReportPage() {
  const router = useRouter();
  const { isHR } = useAuth();
  const now = zonedParts();
  const [period, setPeriod] = useState({ month: now.month, year: now.year });
  const [department, setDepartment] = useState('');

  const departments = useFetch(isHR ? '/departments' : null);
  const teamScope = useTeamScope();
  const { data, loading, error, refetch } = useFetch('/attendance/report', {
    params: { ...period, department: department || undefined, scope: teamScope.scope },
  });

  const exportCsv = () => {
    downloadCsv(
      `attendance-${MONTHS[period.month - 1]}-${period.year}.csv`,
      [
        { header: 'Code', value: (r) => r.employee.employeeCode },
        { header: 'Name', value: (r) => getFullName(r.employee) },
        { header: 'Department', value: (r) => r.employee.department?.name },
        { header: 'Present', value: (r) => r.summary.present },
        { header: 'Half day', value: (r) => r.summary.halfDay },
        { header: 'Absent', value: (r) => r.summary.absent },
        { header: 'Leave', value: (r) => r.summary.leave },
        { header: 'Late', value: (r) => r.summary.late },
        { header: 'Holidays', value: (r) => r.summary.holidays },
        { header: 'Weekly offs', value: (r) => r.summary.weeklyOffs },
        { header: 'Work hours', value: (r) => (r.summary.totalWorkMinutes / 60).toFixed(1) },
      ],
      data?.rows || []
    );
  };

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => <EmployeeCell employee={r.employee} /> },
    { key: 'department', header: 'Department', render: (r) => r.employee.department?.name || '—' },
    { key: 'present', header: 'Present', render: (r) => <span className="text-emerald-600">{r.summary.present}</span> },
    { key: 'half', header: 'Half day', render: (r) => <span className="text-amber-600">{r.summary.halfDay}</span> },
    { key: 'absent', header: 'Absent', render: (r) => <span className="text-red-600">{r.summary.absent}</span> },
    { key: 'leave', header: 'Leave', render: (r) => <span className="text-violet-600">{r.summary.leave}</span> },
    { key: 'late', header: 'Late', render: (r) => r.summary.late },
    { key: 'hours', header: 'Work hours', render: (r) => minutesToHours(r.summary.totalWorkMinutes) },
  ];

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Attendance Report"
        subtitle="Monthly attendance summary per employee"
        actions={
          <>
            <MonthYearPicker month={period.month} year={period.year} onChange={setPeriod} />
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!data?.rows?.length}>
              Export CSV
            </Button>
          </>
        }
      />

      <Card noPadding>
        {(isHR || teamScope.canToggle) && (
          <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
            {isHR && (
              <Select
                className="w-56"
                placeholder="All departments"
                options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            )}
            <TeamScopeToggle {...teamScope} />
          </div>
        )}
        {error && (
          <div className="p-4">
            <ErrorMessage message={error} onRetry={refetch} />
          </div>
        )}
        <DataTable
          columns={columns}
          rows={data?.rows}
          loading={loading}
          rowKey={(r) => r.employee._id}
          onRowClick={(r) => router.push(`/employees/${r.employee._id}`)}
        />
      </Card>
    </RoleGuard>
  );
}
