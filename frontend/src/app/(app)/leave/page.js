'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Plus } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { toInputDate } from '@/lib/format';
import { Badge, Button, Card, DataTable, ErrorMessage, PageHeader, Tabs, useConfirm } from '@/components/ui';
import LeaveBalanceCards from '@/components/leave/LeaveBalanceCards';
import ApplyLeaveModal from '@/components/leave/ApplyLeaveModal';
import LeaveDates from '@/components/leave/LeaveDates';
import QuarterlyLeaveSummary from '@/components/leave/QuarterlyLeaveSummary';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function LeavePage() {
  const confirm = useConfirm();
  const year = new Date().getFullYear();
  const [status, setStatus] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);

  const balances = useFetch('/leaves/balances', { params: { year } });
  const leaves = useFetch('/leaves/my', { params: { status: status || undefined } });

  const refreshAll = () => {
    balances.refetch();
    leaves.refetch();
  };

  const cancelLeave = async (leave) => {
    const ok = await confirm({
      title: 'Cancel this leave?',
      message: `${leave.leaveType?.name} for ${leave.days} day(s) will be cancelled and the balance restored.`,
      confirmText: 'Cancel leave',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.patch(`/leaves/${leave._id}/cancel`);
      toast.success('Leave cancelled');
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const today = toInputDate();
  const canCancel = (l) => l.status === 'pending' || (l.status === 'approved' && l.fromDate > today);

  const columns = [
    {
      key: 'type',
      header: 'Leave type',
      render: (l) => (
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.leaveType?.color }} />
          {l.leaveType?.name}
        </span>
      ),
    },
    { key: 'dates', header: 'Dates', render: (l) => <LeaveDates leave={l} /> },
    { key: 'days', header: 'Days', render: (l) => `${l.days} day${l.days === 1 ? '' : 's'}` },
    { key: 'reason', header: 'Reason', render: (l) => <span className="block max-w-xs truncate text-slate-500" title={l.reason}>{l.reason}</span> },
    { key: 'status', header: 'Status', render: (l) => <Badge status={l.status} /> },
    {
      key: 'reviewer',
      header: 'Reviewed by',
      render: (l) =>
        l.reviewedBy ? (
          <div>
            <p>
              {l.reviewedBy.firstName} {l.reviewedBy.lastName}
            </p>
            {l.reviewNote && <p className="max-w-[200px] truncate text-xs text-slate-500">“{l.reviewNote}”</p>}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (l) =>
        canCancel(l) && (
          <Button size="sm" variant="ghost" onClick={() => cancelLeave(l)}>
            Cancel
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Leave"
        subtitle={`Your balances and requests for ${year}`}
        actions={
          <Button icon={Plus} onClick={() => setApplyOpen(true)} disabled={!balances.data}>
            Apply leave
          </Button>
        }
      />

      <ErrorMessage message={balances.error} onRetry={balances.refetch} />
      <LeaveBalanceCards balances={balances.data} loading={balances.loading} />

      <div className="mt-6">
        <QuarterlyLeaveSummary />
      </div>

      <div className="mt-8 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-slate-900">Leave history</h2>
        <Tabs tabs={STATUS_TABS} value={status} onChange={setStatus} />
      </div>

      <Card noPadding>
        <DataTable
          columns={columns}
          rows={leaves.data}
          loading={leaves.loading}
          emptyIcon={CalendarDays}
          emptyTitle="No leave requests"
          emptyMessage="Planning a break? Apply for leave and your manager will be notified."
          emptyAction={
            <Button size="sm" icon={Plus} onClick={() => setApplyOpen(true)}>
              Apply leave
            </Button>
          }
        />
      </Card>

      <ApplyLeaveModal open={applyOpen} onClose={() => setApplyOpen(false)} balances={balances.data || []} onApplied={refreshAll} />
    </div>
  );
}
