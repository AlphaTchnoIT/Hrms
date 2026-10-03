'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { BadgeIndianRupee, Info, Play } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { payrollRunSchema } from '@/lib/validation';
import { HR_ROLES } from '@/lib/constants';
import { formatCurrency, formatDateTime, MONTHS } from '@/lib/format';
import { Badge, Button, Card, DataTable, Modal, PageHeader, Select } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';

function RunPayrollModal({ runs, onClose }) {
  const router = useRouter();
  const now = new Date();
  const form = useForm({ month: String(now.getMonth() + 1), year: String(now.getFullYear()) }, { schema: payrollRunSchema });
  const { values } = form;

  const existing = runs.find((r) => r.month === Number(values.month) && r.year === Number(values.year));
  const isFuture =
    Number(values.year) > now.getFullYear() || (Number(values.year) === now.getFullYear() && Number(values.month) > now.getMonth() + 1);

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/payroll/runs', data);
    toast.success(res.message);
    router.push(`/payroll/${res.data._id}`);
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Run payroll"
      description="Payslips are calculated from salary, attendance and unpaid leave."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="payroll-form" icon={Play} loading={form.submitting} disabled={isFuture || existing?.status === 'paid'}>
            {existing ? 'Re-run payroll' : 'Process payroll'}
          </Button>
        </>
      }
    >
      <form id="payroll-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select label="Month" placeholder={false} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} {...form.register('month')} />
          <Select
            label="Year"
            placeholder={false}
            options={[now.getFullYear(), now.getFullYear() - 1].map((y) => ({ value: String(y), label: String(y) }))}
            {...form.register('year')}
          />
        </div>
        {(isFuture || existing) && (
          <div className={`flex gap-2 rounded-lg px-3 py-2.5 text-sm ${isFuture || existing?.status === 'paid' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {isFuture
              ? 'Payroll cannot be run for a future month.'
              : existing.status === 'paid'
                ? 'This month is already paid and locked.'
                : 'Payroll already exists for this month. Re-running will recalculate every payslip.'}
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function PayrollPage() {
  const router = useRouter();
  const { data: runs, loading } = useFetch('/payroll/runs');
  const [open, setOpen] = useState(false);

  const columns = [
    { key: 'period', header: 'Pay period', render: (r) => <span className="font-semibold text-slate-900">{MONTHS[r.month - 1]} {r.year}</span> },
    { key: 'employees', header: 'Employees', render: (r) => r.employeeCount },
    { key: 'gross', header: 'Gross', align: 'right', render: (r) => formatCurrency(r.totalGross) },
    { key: 'deductions', header: 'Deductions', align: 'right', render: (r) => formatCurrency(r.totalDeductions) },
    { key: 'net', header: 'Net payout', align: 'right', render: (r) => <span className="font-semibold text-slate-900">{formatCurrency(r.totalNet)}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'processed',
      header: 'Processed',
      render: (r) => (
        <div className="text-xs">
          <p className="text-slate-700">{formatDateTime(r.processedAt)}</p>
          <p className="text-slate-500">by {r.processedBy?.firstName || '—'}</p>
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Payroll"
        subtitle="Process monthly salaries. Unpaid days are deducted automatically."
        actions={
          <Button icon={Play} onClick={() => setOpen(true)}>
            Run payroll
          </Button>
        }
      />

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={runs}
          loading={loading}
          emptyIcon={BadgeIndianRupee}
          emptyTitle="No payroll yet"
          emptyMessage="Run payroll for a month to generate payslips."
          onRowClick={(r) => router.push(`/payroll/${r._id}`)}
        />
      </Card>

      {open && <RunPayrollModal runs={runs || []} onClose={() => setOpen(false)} />}
    </RoleGuard>
  );
}
