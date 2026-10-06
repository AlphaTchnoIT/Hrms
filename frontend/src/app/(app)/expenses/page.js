'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, ExternalLink, Plus, Receipt, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { expenseSchema } from '@/lib/validation';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { formatCurrency, formatDate, titleCase, toInputDate, getCurrencySymbol } from '@/lib/format';
import { Badge, Button, Card, DataTable, Input, Modal, PageHeader, Select, StatCard, Textarea, useConfirm } from '@/components/ui';

const emptyExpense = () => ({ title: '', category: 'travel', amount: '', expenseDate: toInputDate(), description: '', receiptUrl: '' });

function ExpenseFormModal({ open, onClose, onSaved }) {
  const form = useForm(emptyExpense(), { schema: expenseSchema });

  useEffect(() => {
    if (open) form.reset(emptyExpense());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/expenses', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New expense claim"
      description="Claims must be submitted within 90 days."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" loading={form.submitting}>
            Submit claim
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Input label="Title" required placeholder="e.g. Cab to client office" {...form.register('title')} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Category" required placeholder={false} options={EXPENSE_CATEGORIES} {...form.register('category')} />
          <Input label="Amount" type="number" min="1" step="0.01" prefix={getCurrencySymbol()} required {...form.register('amount')} />
        </div>
        <Input label="Expense date" type="date" required max={toInputDate()} {...form.register('expenseDate')} />
        <Input
          label="Receipt link"
          type="url"
          placeholder="https://drive.google.com/..."
          hint="Upload the bill to your drive and paste the share link"
          {...form.register('receiptUrl')}
        />
        <Textarea label="Description" maxLength={500} {...form.register('description')} />
      </form>
    </Modal>
  );
}

export default function ExpensesPage() {
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const { data, loading, refetch } = useFetch('/expenses/my');

  const totals = (data || []).reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + e.amount;
      return acc;
    },
    { pending: 0, approved: 0, reimbursed: 0 }
  );

  const deleteExpense = async (expense) => {
    const ok = await confirm({
      title: 'Delete this claim?',
      message: `"${expense.title}" (${formatCurrency(expense.amount)}) will be removed.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/expenses/${expense._id}`);
      toast.success('Expense deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
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
    { key: 'amount', header: 'Amount', align: 'right', render: (e) => <span className="font-semibold text-slate-900">{formatCurrency(e.amount)}</span> },
    {
      key: 'receipt',
      header: 'Receipt',
      render: (e) =>
        e.receiptUrl ? (
          <a href={e.receiptUrl} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1 text-sm">
            View <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    { key: 'status', header: 'Status', render: (e) => <Badge status={e.status} /> },
    { key: 'note', header: 'Reviewer note', render: (e) => <span className="text-slate-500">{e.reviewNote || '—'}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (e) =>
        e.status === 'pending' && (
          <Button size="sm" variant="ghost" onClick={() => deleteExpense(e)}>
            Delete
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Expense Claims"
        subtitle="Submit business expenses and track reimbursements."
        actions={
          <Button icon={Plus} onClick={() => setFormOpen(true)}>
            New claim
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Awaiting approval" value={formatCurrency(totals.pending)} icon={Clock} tone="yellow" />
        <StatCard label="Approved · to be paid" value={formatCurrency(totals.approved)} icon={CheckCircle2} tone="blue" />
        <StatCard label="Reimbursed" value={formatCurrency(totals.reimbursed)} icon={Wallet} tone="green" />
      </div>

      <Card noPadding title="My claims">
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          emptyIcon={Receipt}
          emptyTitle="No expense claims yet"
          emptyMessage="Spent money on work? Submit a claim to get reimbursed."
          emptyAction={
            <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>
              New claim
            </Button>
          }
        />
      </Card>

      <ExpenseFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
    </div>
  );
}
