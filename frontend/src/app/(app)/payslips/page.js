'use client';

import { useRouter } from 'next/navigation';
import { useFetch } from '@/hooks/useFetch';
import { formatCurrency, MONTHS } from '@/lib/format';
import { Badge, Card, DataTable, PageHeader } from '@/components/ui';

export default function MyPayslipsPage() {
  const router = useRouter();
  const { data, loading } = useFetch('/payroll/my-payslips');

  const columns = [
    { key: 'month', header: 'Month', render: (p) => <span className="font-medium">{MONTHS[p.month - 1]} {p.year}</span> },
    { key: 'paidDays', header: 'Paid days' },
    { key: 'lopDays', header: 'LOP days' },
    { key: 'gross', header: 'Gross', render: (p) => formatCurrency(p.grossEarnings) },
    { key: 'deductions', header: 'Deductions', render: (p) => formatCurrency(p.totalDeductions) },
    { key: 'net', header: 'Net pay', render: (p) => <strong className="text-brand-700">{formatCurrency(p.netPay)}</strong> },
    { key: 'status', header: 'Status', render: (p) => <Badge status={p.status} /> },
  ];

  return (
    <div>
      <PageHeader title="My Payslips" subtitle="Click a payslip to view and download" />
      <Card noPadding>
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          emptyMessage="No payslips available yet"
          onRowClick={(p) => router.push(`/payslips/${p._id}`)}
        />
      </Card>
    </div>
  );
}
