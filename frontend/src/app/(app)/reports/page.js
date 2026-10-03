'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Download, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { ROLES } from '@/lib/constants';
import { downloadCsv } from '@/lib/csv';
import { getFullName, toInputDate } from '@/lib/format';
import { Button, Card, DataTable, EmptyState, ErrorMessage, Input, PageHeader, Select } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';

const daysAgo = (n) => toInputDate(new Date(Date.now() - n * 86400000));

export default function ReportsCentrePage() {
  const { isHR } = useAuth();
  const [type, setType] = useState('');
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(toInputDate());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [manager, setManager] = useState('');
  const [department, setDepartment] = useState('');

  const reports = useFetch('/reports');
  const managers = useFetch(isHR ? '/employees/directory' : null, { params: { role: 'manager', limit: 200 } });
  const departments = useFetch(isHR ? '/departments' : null);
  const { data, loading, error, refetch } = useFetch(type ? `/reports/${type}` : null, {
    params: { from, to, year: type === 'leave-quarterly' ? year : undefined, manager: manager || undefined, department: department || undefined },
  });

  const columns = (data?.columns || []).map((c) => ({ key: c.key, header: c.header, render: (row) => (row[c.key] === '' || row[c.key] === null || row[c.key] === undefined ? '—' : String(row[c.key])) }));
  const exportCsv = () =>
    downloadCsv(
      `${type}-${from}-to-${to}.csv`,
      data.columns.map((c) => ({ header: c.header, value: (row) => row[c.key] })),
      data.rows
    );

  return (
    <RoleGuard roles={[ROLES.ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.QA, ROLES.IT]}>
      <PageHeader
        title="Reports Centre"
        subtitle="Generate and export employee, team, attendance, KPI, QA, escalation and other operational reports"
        actions={
          <Button icon={Download} disabled={!data?.rows?.length} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card noPadding title="Reports">
          <ul className="p-2">
            {(reports.data || []).map((r) => (
              <li key={r.key}>
                <button
                  onClick={() => setType(r.key)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm',
                    type === r.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <FileSpreadsheet className="h-4 w-4 shrink-0" />
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap gap-3">
            {type === 'leave-quarterly' ? (
              <Input label="Year" type="number" className="w-32" value={year} onChange={(e) => setYear(e.target.value)} />
            ) : (
              <>
                <Input label="From" type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Input label="To" type="date" className="w-44" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
              </>
            )}
            {isHR && (
              <>
                <Select
                  label="Team"
                  className="w-56"
                  placeholder="Everyone"
                  options={(managers.data || []).map((m) => ({ value: m._id, label: `Team of ${getFullName(m)}` }))}
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                />
                <Select
                  label="Department"
                  className="w-48"
                  placeholder="All"
                  options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </>
            )}
          </div>
          <ErrorMessage message={error} onRetry={refetch} />
          {!type ? (
            <Card>
              <EmptyState icon={FileSpreadsheet} title="Choose a report" message="Pick a report on the left, set the filters and export it as CSV." />
            </Card>
          ) : (
            <Card noPadding title={data?.title} subtitle={data ? `${data.rows.length} rows` : undefined}>
              <DataTable columns={columns} rows={data?.rows} loading={loading} rowKey={(r) => JSON.stringify(r)} emptyMessage="No data for these filters" />
            </Card>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
