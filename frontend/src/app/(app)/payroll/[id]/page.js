'use client';

import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CheckCircle2, Download, RefreshCw, Trash2, Users } from 'lucide-react';
import { CurrencyIcon } from '@/components/shared/CurrencyIcon';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { HR_ROLES } from '@/lib/constants';
import { formatCurrency, MONTHS } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { Badge, Button, Card, DataTable, ErrorMessage, PageHeader, PageLoader, StatCard, useConfirm } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';

export default function PayrollRunPage() {
  const { id } = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useFetch(`/payroll/runs/${id}`);

  const act = async (fn, successMessage) => {
    try {
      const res = await fn();
      toast.success(res.message || successMessage);
      return res;
    } catch (err) {
      toast.error(err.message);
      return null;
    }
  };

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorMessage message={error} />;

  const { run, payslips } = data;
  const isPaid = run.status === 'paid';
  const periodLabel = `${MONTHS[run.month - 1]} ${run.year}`;

  const rerun = async () => {
    const ok = await confirm({
      title: 'Re-run payroll?',
      message: `All payslips for ${periodLabel} will be recalculated with the latest salary and attendance.`,
      confirmText: 'Re-run',
    });
    if (!ok) return;
    const res = await act(() => api.post('/payroll/runs', { month: run.month, year: run.year }));
    if (res) refetch();
  };

  const markPaid = async () => {
    const ok = await confirm({
      title: 'Mark payroll as paid?',
      message: `${formatCurrency(run.totalNet)} for ${run.employeeCount} employees. Payslips become visible to employees and this run is locked.`,
      confirmText: 'Mark as paid',
    });
    if (!ok) return;
    const res = await act(() => api.patch(`/payroll/runs/${id}/mark-paid`));
    if (res) refetch();
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete this payroll run?',
      message: `All ${run.employeeCount} payslips for ${periodLabel} will be deleted.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const res = await act(() => api.delete(`/payroll/runs/${id}`));
    if (res) router.push('/payroll');
  };

  const exportCsv = () =>
    downloadCsv(
      `payroll-${periodLabel}.csv`,
      [
        { header: 'Code', value: (p) => p.employeeSnapshot.employeeCode },
        { header: 'Name', value: (p) => p.employeeSnapshot.name },
        { header: 'Department', value: (p) => p.employeeSnapshot.department },
        { header: 'NI number', value: (p) => p.employeeSnapshot.niNumber },
        { header: 'Tax code', value: (p) => p.employeeSnapshot.taxCode },
        { header: 'Bank', value: (p) => p.employeeSnapshot.bankName },
        { header: 'Sort code', value: (p) => p.employeeSnapshot.sortCode },
        { header: 'Account', value: (p) => p.employeeSnapshot.accountNumber },
        { header: 'Paid days', value: (p) => p.paidDays },
        { header: 'Unpaid days', value: (p) => p.lopDays },
        { header: 'Gross', value: (p) => p.grossEarnings },
        ...['Income Tax', 'National Insurance', 'Pension', 'Student Loan', 'Postgraduate Loan'].map((name) => ({
          header: name,
          value: (p) => p.deductions.filter((d) => d.name.startsWith(name)).reduce((sum, d) => sum + d.amount, 0),
        })),
        { header: 'Total deductions', value: (p) => p.totalDeductions },
        { header: 'Net pay', value: (p) => p.netPay },
        { header: 'Employer NI', value: (p) => p.employerContributions?.find((c) => c.name.includes('National Insurance'))?.amount || 0 },
        { header: 'Employer pension', value: (p) => p.employerContributions?.find((c) => c.name.includes('pension'))?.amount || 0 },
      ],
      payslips
    );

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      render: (p) => (
        <div>
          <p className="font-medium text-slate-800">{p.employeeSnapshot.name}</p>
          <p className="text-xs text-slate-500">
            {p.employeeSnapshot.employeeCode} · {p.employeeSnapshot.department || '—'}
          </p>
        </div>
      ),
    },
    { key: 'paidDays', header: 'Paid days', render: (p) => `${p.paidDays} / ${p.totalDays}` },
    { key: 'lop', header: 'Unpaid days', render: (p) => (p.lopDays ? <span className="text-red-600">{p.lopDays}</span> : 0) },
    { key: 'gross', header: 'Gross', render: (p) => formatCurrency(p.grossEarnings) },
    { key: 'deductions', header: 'Deductions', render: (p) => formatCurrency(p.totalDeductions) },
    { key: 'net', header: 'Net pay', render: (p) => <strong>{formatCurrency(p.netPay)}</strong> },
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title={`Payroll – ${periodLabel}`}
        back={{ href: '/payroll', label: 'All payroll runs' }}
        subtitle={
          <span className="flex items-center gap-2">
            <Badge status={run.status} /> {isPaid ? 'Locked · visible to employees' : 'Draft · not visible to employees yet'}
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportCsv}>
              Bank sheet (CSV)
            </Button>
            {!isPaid && (
              <>
                <Button variant="secondary" icon={RefreshCw} onClick={rerun}>
                  Re-run
                </Button>
                <Button variant="danger" icon={Trash2} onClick={remove}>
                  Delete
                </Button>
                <Button variant="success" icon={CheckCircle2} onClick={markPaid}>
                  Mark as paid
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Employees" value={run.employeeCount} icon={Users} />
        <StatCard label="Total gross" value={formatCurrency(run.totalGross)} icon={CurrencyIcon} tone="blue" />
        <StatCard label="Total deductions" value={formatCurrency(run.totalDeductions)} icon={CurrencyIcon} tone="red" />
        <StatCard label="Net payout" value={formatCurrency(run.totalNet)} icon={CurrencyIcon} tone="green" />
      </div>

      <Card noPadding>
        <DataTable columns={columns} rows={payslips} onRowClick={(p) => router.push(`/payslips/${p._id}`)} />
      </Card>
    </RoleGuard>
  );
}
