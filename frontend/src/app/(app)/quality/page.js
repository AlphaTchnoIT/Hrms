'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ClipboardCheck, Star, TriangleAlert } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { formatDate, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Card, EmptyState, ErrorMessage, Modal, PageHeader, PageLoader, StatCard, Textarea } from '@/components/ui';

export default function MyQaFeedbackPage() {
  const { data, loading, error, refetch } = useFetch('/quality/feedback/my');
  const [acking, setAcking] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const items = data || [];

  const acknowledge = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/quality/feedback/${acking._id}/acknowledge`, { comment });
      toast.success(res.message);
      setAcking(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const pending = items.filter((f) => !f.acknowledgedAt).length;
  const avg = items.length ? Math.round(items.slice(0, 10).reduce((s, f) => s + (f.isFatal ? 0 : f.score), 0) / Math.min(10, items.length)) : null;
  const errorCounts = {};
  items.forEach((f) => f.errorCategories.forEach((c) => (errorCounts[c] = (errorCounts[c] || 0) + 1)));
  const topErrors = Object.entries(errorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div>
      <PageHeader title="QA Feedback" subtitle="Quality audits of your interactions. Please review and acknowledge each one." />
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Waiting for acknowledgement" value={pending} icon={ClipboardCheck} tone={pending ? 'yellow' : 'green'} />
            <StatCard label="Average of last 10 audits" value={avg === null ? '—' : `${avg}%`} icon={Star} />
            <StatCard
              label="Most repeated errors"
              value={topErrors.length ? titleCase(topErrors[0][0]) : 'None'}
              hint={topErrors.map(([c, n]) => `${titleCase(c)} ×${n}`).join(' · ')}
              icon={TriangleAlert}
              tone="red"
            />
          </div>
          {!items.length && <EmptyState icon={Star} message="No QA audits yet." />}
          <div className="space-y-3">
            {items.map((f) => (
              <Card key={f._id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {f.interactionRef || 'Interaction'} · {formatDate(f.auditDate)}
                    </p>
                    <p className="text-xs text-slate-500">Audited by {getFullName(f.auditor)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.isFatal && <Badge color="red">Fatal error</Badge>}
                    <span className={`text-xl font-semibold ${f.isFatal || f.score < 80 ? 'text-rose-600' : f.score < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {f.isFatal ? '0' : f.score}%
                    </span>
                  </div>
                </div>
                {f.errorCategories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {f.errorCategories.map((c) => (
                      <Badge key={c} color="red" dot={false}>
                        {titleCase(c)}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  {f.strengths && (
                    <p>
                      <span className="font-medium text-emerald-700">Strengths: </span>
                      {f.strengths}
                    </p>
                  )}
                  {f.improvements && (
                    <p>
                      <span className="font-medium text-amber-700">Improve: </span>
                      {f.improvements}
                    </p>
                  )}
                  {f.comments && <p className="sm:col-span-2 text-slate-600">{f.comments}</p>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  {f.acknowledgedAt ? (
                    <span className="text-emerald-700">
                      Acknowledged {formatDate(f.acknowledgedAt)}
                      {f.employeeComment ? ` — “${f.employeeComment}”` : ''}
                    </span>
                  ) : (
                    <span className="font-medium text-amber-700">Not acknowledged</span>
                  )}
                  {!f.acknowledgedAt && (
                    <Button size="sm" onClick={() => { setComment(''); setAcking(f); }}>
                      Acknowledge
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      <Modal
        open={Boolean(acking)}
        onClose={() => setAcking(null)}
        title="Acknowledge QA feedback"
        description="Confirms you have reviewed this audit."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAcking(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={acknowledge}>
              Acknowledge
            </Button>
          </>
        }
      >
        <Textarea label="Comment (optional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </div>
  );
}
