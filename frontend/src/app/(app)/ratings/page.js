'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Sparkles, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { AUDITOR_ROLES, RATING_LABELS } from '@/lib/constants';
import { formatDateTime, getFullName, zonedParts } from '@/lib/format';
import { Badge, Button, Card, DataTable, ErrorMessage, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';
import { RatingStars } from '@/components/performance/KpiWidgets';

const lastMonth = () => {
  const { year, month } = zonedParts();
  const [y, m] = month === 1 ? [year - 1, 12] : [year, month - 1];
  return `${y}-${String(m).padStart(2, '0')}`;
};

function ApprovalCell({ approval, label }) {
  if (!approval?.by) return <span className="text-xs text-slate-400">{label}: waiting</span>;
  return (
    <span className={`text-xs ${approval.approved ? 'text-emerald-700' : 'text-rose-700'}`} title={approval.comment || ''}>
      {label}: {approval.approved ? 'approved' : 'disputed'} by {approval.by.firstName}
      <span className="block text-[11px] text-slate-400">{formatDateTime(approval.at)}</span>
    </span>
  );
}

/*
 * Monthly 3-parameter ratings. Managers generate and adjust; QA and HR must both approve (mutual approval).
 */
export default function RatingApprovalsPage() {
  const { user, isApprover, isAdmin } = useAuth();
  const [period, setPeriod] = useState(lastMonth());
  const [status, setStatus] = useState('pending-approval');
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(null); // { review, approved }
  const [adjusting, setAdjusting] = useState(null);
  const [form, setForm] = useState({ comment: '', side: 'hr', finalRating: '', managerComment: '' });
  const [saving, setSaving] = useState(false);
  const { data, loading, error, refetch } = useFetch('/performance/ratings', { params: { period: period || undefined, status: status || undefined } });

  const canApprove = ['admin', 'hr', 'qa'].includes(user?.role);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/performance/ratings/generate', { period });
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const submitApproval = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/performance/ratings/${approving.review._id}/approve`, {
        approved: approving.approved,
        comment: form.comment,
        ...(isAdmin ? { side: form.side } : {}),
      });
      toast.success(res.message);
      setApproving(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitAdjust = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/performance/ratings/${adjusting._id}`, { finalRating: Number(form.finalRating), managerComment: form.managerComment });
      toast.success(res.message);
      setAdjusting(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'employee', header: 'Employee', render: (r) => <EmployeeCell employee={r.user} /> },
    { key: 'period', header: 'Month' },
    { key: 'quality', header: 'Quality', render: (r) => (r.scores?.quality ?? '—') + (r.scores?.quality !== null && r.scores?.quality !== undefined ? '%' : '') },
    { key: 'efficiency', header: 'Efficiency', render: (r) => (r.scores?.efficiency ?? '—') + (r.scores?.efficiency !== null && r.scores?.efficiency !== undefined ? '%' : '') },
    { key: 'classification', header: 'Classification', render: (r) => (r.scores?.classification ?? '—') + (r.scores?.classification !== null && r.scores?.classification !== undefined ? '%' : '') },
    { key: 'system', header: 'System', render: (r) => <RatingStars value={r.systemRating} /> },
    {
      key: 'final',
      header: 'Final rating',
      render: (r) => (
        <div>
          <RatingStars value={r.finalRating} />
          {r.managerComment && <p className="max-w-[200px] truncate text-[11px] italic text-slate-500" title={r.managerComment}>“{r.managerComment}”</p>}
        </div>
      ),
    },
    {
      key: 'approvals',
      header: 'QA / HR approval',
      render: (r) => (
        <div className="space-y-1">
          <ApprovalCell approval={r.qaApproval} label="QA" />
          <ApprovalCell approval={r.hrApproval} label="HR" />
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <Badge status={r.status} /> },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        r.status !== 'approved' && (
          <div className="flex flex-wrap gap-1">
            {canApprove && (
              <>
                <Button size="xs" variant="success-soft" icon={Check} onClick={() => { setForm((f) => ({ ...f, comment: '' })); setApproving({ review: r, approved: true }); }}>
                  Approve
                </Button>
                <Button size="xs" variant="danger-soft" icon={X} onClick={() => { setForm((f) => ({ ...f, comment: '' })); setApproving({ review: r, approved: false }); }}>
                  Dispute
                </Button>
              </>
            )}
            {isApprover && (
              <Button size="xs" variant="secondary" onClick={() => { setForm((f) => ({ ...f, finalRating: String(r.finalRating), managerComment: r.managerComment || '' })); setAdjusting(r); }}>
                Adjust
              </Button>
            )}
          </div>
        ),
    },
  ];

  return (
    <RoleGuard roles={AUDITOR_ROLES}>
      <PageHeader
        title="Rating Approvals"
        subtitle="Monthly rating on quality, efficiency and classification — approved jointly by the QA and HR teams"
        actions={
          isApprover && (
            <Button icon={Sparkles} loading={generating} onClick={generate}>
              Generate ratings for {period || 'month'}
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input type="month" className="w-48" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Month" />
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'pending-approval', label: 'Waiting for approval' },
            { value: 'disputed', label: 'Disputed' },
            { value: 'approved', label: 'Approved' },
            { value: '', label: 'All' },
          ]}
        />
      </div>
      <ErrorMessage message={error} onRetry={refetch} />
      <Card noPadding>
        <DataTable columns={columns} rows={data} loading={loading} emptyMessage="No ratings for this month. Managers can generate them from KPI results." />
      </Card>

      <Modal
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        title={approving?.approved ? 'Approve rating' : 'Dispute rating'}
        description={approving && `${getFullName(approving.review.user)} · ${approving.review.period} · ${approving.review.finalRating}/5 (${RATING_LABELS[approving.review.finalRating]})`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproving(null)}>
              Cancel
            </Button>
            <Button variant={approving?.approved ? 'success' : 'danger'} loading={saving} onClick={submitApproval}>
              {approving?.approved ? 'Approve' : 'Dispute'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {isAdmin && (
            <Select
              label="Approve on behalf of"
              placeholder={false}
              options={[
                { value: 'hr', label: 'HR team' },
                { value: 'qa', label: 'QA team' },
              ]}
              value={form.side}
              onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
            />
          )}
          <Textarea
            label={approving?.approved ? 'Comment (optional)' : 'Reason for dispute'}
            required={!approving?.approved}
            maxLength={1000}
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
          />
          <p className="text-xs text-slate-500">The rating is published to the employee only after both QA and HR approve it.</p>
        </div>
      </Modal>

      <Modal
        open={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title="Adjust final rating"
        description="Changing the rating restarts the QA and HR approvals."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={submitAdjust}>
              Save & resubmit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Final rating"
            placeholder={false}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} – ${RATING_LABELS[n]}` }))}
            value={form.finalRating}
            onChange={(e) => setForm((f) => ({ ...f, finalRating: e.target.value }))}
          />
          <Textarea
            label="Manager comment"
            hint={adjusting && Number(form.finalRating) !== adjusting.systemRating ? 'Required when the rating differs from the system rating' : undefined}
            maxLength={1000}
            value={form.managerComment}
            onChange={(e) => setForm((f) => ({ ...f, managerComment: e.target.value }))}
          />
        </div>
      </Modal>
    </RoleGuard>
  );
}
