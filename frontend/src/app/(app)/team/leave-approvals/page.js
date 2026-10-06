'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { Badge, Button, Card, DataTable, ErrorMessage, PageHeader, Pagination, Tabs } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import ReviewModal from '@/components/shared/ReviewModal';
import RoleGuard from '@/components/layout/RoleGuard';
import { useTeamScope } from '@/hooks/useTeamScope';
import TeamScopeToggle from '@/components/shared/TeamScopeToggle';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function LeaveApprovalsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(null); // { leave, action }

  const teamScope = useTeamScope();
  const changeScope = (value) => {
    teamScope.setScope(value);
    setPage(1);
  };
  const { data, meta, loading, error, refetch } = useFetch('/leaves', {
    params: { status: status || undefined, page, limit: 15, scope: teamScope.scope },
  });

  const submitReview = async (note) => {
    const res = await api.patch(`/leaves/${review.leave._id}/review`, { action: review.action, note });
    toast.success(res.message);
    setReview(null);
    refetch();
  };

  const columns = [
    { key: 'employee', header: 'Employee', render: (l) => <EmployeeCell employee={l.user} /> },
    {
      key: 'type',
      header: 'Type',
      render: (l) => (
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.leaveType?.color }} />
          {l.leaveType?.name}
        </span>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (l) =>
        l.isHalfDay
          ? `${formatDate(l.fromDate)} (${titleCase(l.halfDaySession)})`
          : `${formatDate(l.fromDate)} → ${formatDate(l.toDate)}`,
    },
    {
      key: 'days',
      header: 'Days',
      render: (l) => {
        // UK: sickness of more than 7 days in a row needs a fit note from a doctor
        const calendarDays = (new Date(l.toDate) - new Date(l.fromDate)) / 86400000 + 1;
        const sick = /sick|ssp/i.test(`${l.leaveType?.name} ${l.leaveType?.code}`);
        return (
          <span>
            {l.days}
            {sick && calendarDays > 7 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">Fit note needed</span>}
          </span>
        );
      },
    },
    { key: 'reason', header: 'Reason', render: (l) => <span className="block max-w-xs truncate" title={l.reason}>{l.reason}</span> },
    { key: 'applied', header: 'Applied on', render: (l) => formatDate(l.createdAt) },
    { key: 'status', header: 'Status', render: (l) => <Badge status={l.status} /> },
    {
      key: 'actions',
      header: '',
      render: (l) =>
        l.status === 'pending' ? (
          <div className="flex gap-1">
            <Button size="sm" variant="success-soft" icon={Check} onClick={() => setReview({ leave: l, action: 'approve' })}>
              Approve
            </Button>
            <Button size="sm" variant="danger-soft" icon={X} onClick={() => setReview({ leave: l, action: 'reject' })}>
              Reject
            </Button>
          </div>
        ) : (
          l.reviewedBy && (
            <span className="text-xs text-slate-500">
              by {l.reviewedBy.firstName} · {formatDateTime(l.reviewedAt)}
            </span>
          )
        ),
    },
  ];

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader title="Leave Approvals" subtitle="Review leave requests from your team" actions={<TeamScopeToggle {...teamScope} setScope={changeScope} />} />
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
        <DataTable columns={columns} rows={data} loading={loading} emptyMessage="No leave requests here" />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>

      <ReviewModal
        open={Boolean(review)}
        action={review?.action}
        title={review?.action === 'approve' ? 'Approve leave' : 'Reject leave'}
        onClose={() => setReview(null)}
        onSubmit={submitReview}
      >
        {review && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p>
              <strong>
                {review.leave.user?.firstName} {review.leave.user?.lastName}
              </strong>{' '}
              — {review.leave.leaveType?.name}, {review.leave.days} day(s)
            </p>
            <p className="mt-1 text-slate-600">
              {formatDate(review.leave.fromDate)} → {formatDate(review.leave.toDate)}
            </p>
            <p className="mt-1 text-slate-600">“{review.leave.reason}”</p>
          </div>
        )}
      </ReviewModal>
    </RoleGuard>
  );
}
