'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, X } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Badge, Button, Card, DataTable, ErrorMessage, PageHeader, Pagination, Tabs } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import ReviewModal from '@/components/shared/ReviewModal';
import RoleGuard from '@/components/layout/RoleGuard';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
];

export default function RegularizationsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [review, setReview] = useState(null);

  const { data, meta, loading, error, refetch } = useFetch('/attendance/regularizations', {
    params: { status: status || undefined, page, limit: 15 },
  });

  const submitReview = async (note) => {
    const res = await api.patch(`/attendance/regularizations/${review.item._id}/review`, { action: review.action, note });
    toast.success(res.message);
    setReview(null);
    refetch();
  };

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => <EmployeeCell employee={r.user} /> },
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date) },
    { key: 'time', header: 'Requested time', render: (r) => `${r.checkInTime} – ${r.checkOutTime}` },
    { key: 'reason', header: 'Reason', render: (r) => <span className="block max-w-xs truncate" title={r.reason}>{r.reason}</span> },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        r.status === 'pending' ? (
          <div className="flex gap-1">
            <Button size="sm" variant="success-soft" icon={Check} onClick={() => setReview({ item: r, action: 'approve' })}>
              Approve
            </Button>
            <Button size="sm" variant="danger-soft" icon={X} onClick={() => setReview({ item: r, action: 'reject' })}>
              Reject
            </Button>
          </div>
        ) : (
          <span className="text-xs text-slate-500">{r.reviewedBy ? `by ${r.reviewedBy.firstName}` : ''}</span>
        ),
    },
  ];

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader title="Attendance Regularizations" subtitle="Approved requests update the attendance record automatically" />
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
        <DataTable columns={columns} rows={data} loading={loading} emptyMessage="No requests here" />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>

      <ReviewModal open={Boolean(review)} action={review?.action} onClose={() => setReview(null)} onSubmit={submitReview}>
        {review && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <p>
              <strong>
                {review.item.user?.firstName} {review.item.user?.lastName}
              </strong>{' '}
              — {formatDate(review.item.date)}
            </p>
            <p className="mt-1 text-slate-600">
              {review.item.checkInTime} – {review.item.checkOutTime}
            </p>
            <p className="mt-1 text-slate-600">“{review.item.reason}”</p>
          </div>
        )}
      </ReviewModal>
    </RoleGuard>
  );
}
