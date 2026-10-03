'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Plus, Search } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { HR_ROLES, EMPLOYEE_STATUS, ROLES } from '@/lib/constants';
import { formatDate, getFullName, titleCase } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { Badge, Button, Card, DataTable, ErrorMessage, PageHeader, Pagination, Select } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';

export default function EmployeesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState({ department: '', status: 'active', role: '' });
  const [page, setPage] = useState(1);

  // Wait until the user stops typing before searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const departments = useFetch('/departments');
  const { data, meta, loading, error, refetch } = useFetch('/employees', {
    params: { ...filters, search: debouncedSearch, page, limit: 15 },
  });

  const setFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const exportCsv = () => {
    downloadCsv('employees.csv', [
      { header: 'Code', value: (e) => e.employeeCode },
      { header: 'Name', value: (e) => getFullName(e) },
      { header: 'Email', value: (e) => e.email },
      { header: 'Phone', value: (e) => e.phone },
      { header: 'Department', value: (e) => e.department?.name },
      { header: 'Designation', value: (e) => e.designation?.title },
      { header: 'Manager', value: (e) => (e.reportingManager ? getFullName(e.reportingManager) : '') },
      { header: 'Joining date', value: (e) => formatDate(e.dateOfJoining) },
      { header: 'Status', value: (e) => e.status },
    ], data || []);
  };

  const columns = [
    { key: 'name', header: 'Employee', render: (e) => <EmployeeCell employee={e} subtitle={e.email} /> },
    { key: 'code', header: 'Code', render: (e) => e.employeeCode },
    { key: 'department', header: 'Department', render: (e) => e.department?.name || '—' },
    { key: 'designation', header: 'Designation', render: (e) => e.designation?.title || '—' },
    { key: 'manager', header: 'Manager', render: (e) => (e.reportingManager ? getFullName(e.reportingManager) : '—') },
    { key: 'doj', header: 'Joined', render: (e) => formatDate(e.dateOfJoining) },
    { key: 'role', header: 'Role', render: (e) => <Badge status={e.role} /> },
    { key: 'status', header: 'Status', render: (e) => <Badge status={e.status} /> },
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Employees"
        subtitle={meta ? `${meta.total} employee(s)` : 'Manage your workforce'}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!data?.length}>
              Export
            </Button>
            <Link href="/employees/new">
              <Button icon={Plus}>Add employee</Button>
            </Link>
          </>
        }
      />

      <Card noPadding>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              className="form-control pl-9"
              placeholder="Search name, email, code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            placeholder="All departments"
            options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))}
            value={filters.department}
            onChange={(e) => setFilter('department', e.target.value)}
          />
          <Select
            placeholder="All statuses"
            options={EMPLOYEE_STATUS}
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          />
          <Select
            placeholder="All roles"
            options={Object.values(ROLES).map((r) => ({ value: r, label: titleCase(r) }))}
            value={filters.role}
            onChange={(e) => setFilter('role', e.target.value)}
          />
        </div>

        {error && (
          <div className="p-4">
            <ErrorMessage message={error} onRetry={refetch} />
          </div>
        )}
        <DataTable columns={columns} rows={data} loading={loading} onRowClick={(e) => router.push(`/employees/${e._id}`)} />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>
    </RoleGuard>
  );
}
