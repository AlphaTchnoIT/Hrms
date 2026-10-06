'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, ExternalLink, Wallet, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { formatCurrency, formatDate, titleCase } from '@/lib/format';
import { Badge, Button, Card, DataTable, ErrorMessage, PageHeader, Pagination, Tabs, useConfirm } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import ReviewModal from '@/components/shared/ReviewModal';
import RoleGuard from '@/components/layout/RoleGuard';
import { useTeamScope } from '@/hooks/useTeamScope';
import TeamScopeToggle from '@/components/shared/TeamScopeToggle';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'reimbursed', label: 'Reimbursed' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function ExpenseApprovalsPage() {
  const { isHR } = useAuth();
  const confirm = useConfirm();
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(null);

  const teamScope = useTeamScope();
  const changeScope = (value) => {
    teamScope.setScope(value);
    setPage(1);
  };
  const { data, meta, loading, error, refetch } = useFetch('/expenses', {
    params: { status: status || undefined, page, limit: 15, scope: teamScope.scope },
  });

  const submitReview = async (note) => {
    const res = await api.patch(`/expenses/${review.item._id}/review`, { action: review.action, note });
    toast.success(res.message);
    setReview(null);
    refetch();
  };

  const reimburse = async (expense) => {
    const ok = await confirm({
      title: 'Mark as reimbursed?',
      message: `${formatCurrency(expense.amount)} for "${expense.title}" will be marked as paid to the employee.`,
      confirmText: 'Mark reimbursed',
    });
    if (!ok) return;
    try {
      const res = await api.patch(`/expenses/${expense._id}/reimburse`);
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'employee', header: 'Employee', render: (e) => <EmployeeCell employee={e.user} /> },
    {
      key: 'title',
      header: 'Expense',
      render: (e) => (
        <div>
          <p className="font-medium text-slate-800">{e.title}</p>
          <p className="text-xs text-slate-500">{titleCase(e.category)}</p>
        </div>
      ),
    },
    { key: 'date', header: 'Date', render: (e) => formatDate(e.expenseDate) },
    { key: 'amount', header: 'Amount', render: (e) => <strong>{formatCurrency(e.amount)}</strong> },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (e) =>
        e.receiptUrl ? (
          <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600">
            View <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          '—'
        ),
    },
    { key: 'status', header: 'Status', render: (e) => <Badge status={e.status} /> },
    {
      key: 'actions',
      header: '',
      render: (e) => (
        <div className="flex gap-1">
          {e.status === 'pending' && (
            <>
              <Button size="sm" variant="success-soft" icon={Check} onClick={() => setReview({ item: e, action: 'approve' })}>
                Approve
              </Button>
              <Button size="sm" variant="danger-soft" icon={X} onClick={() => setReview({ item: e, action: 'reject' })}>
                Reject
              </Button>
            </>
          )}
          {e.status === 'approved' && isHR && (
            <Button size="sm" icon={Wallet} onClick={() => reimburse(e)}>
              Mark reimbursed
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader title="Expense Approvals" subtitle="Review and reimburse expense claims" actions={<TeamScopeToggle {...teamScope} setScope={changeScope} />} />
      <Tabs
        tabs={TABS}
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      <Card noPadding className="mt-4">
        {error && (
          <div className="p-4">
            <ErrorMessage message={error} onRetry={refetch} />
          </div>
        )}
        <DataTable columns={columns} rows={data} loading={loading} emptyMessage="No expense claims here" />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>

      <ReviewModal open={Boolean(review)} action={review?.action} onClose={() => setReview(null)} onSubmit={submitReview}>
        {review && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p>
              <strong>{review.item.title}</strong> — {formatCurrency(review.item.amount)}
            </p>
            <p className="mt-1 text-slate-600">{review.item.description || 'No description'}</p>
          </div>
        )}
      </ReviewModal>
    </RoleGuard>
  );
}
