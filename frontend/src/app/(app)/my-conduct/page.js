'use client';

import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { WARNING_STAGES } from '@/lib/constants';
import { formatDate, formatDateTime, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Card, Checkbox, EmptyState, ErrorMessage, Modal, PageHeader, PageLoader, Textarea } from '@/components/ui';

const STAGE_TONE = { 0: 'bg-slate-100 text-slate-500', 1: 'bg-amber-100 text-amber-800', 2: 'bg-orange-100 text-orange-800', 3: 'bg-rose-100 text-rose-800', 4: 'bg-rose-600 text-white' };

export default function MyConductPage() {
  const { data, loading, error, refetch } = useFetch('/relations/warnings/my');
  const [acking, setAcking] = useState(null);
  const [comment, setComment] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const acknowledge = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/relations/warnings/${acking._id}/acknowledge`, { comment });
      toast.success(res.message);
      setAcking(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="My Conduct" subtitle="Warnings issued to you, by category and stage. Each warning must be acknowledged electronically." />
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <>
          {data.pendingAcknowledgement > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ShieldAlert className="h-4 w-4" /> You have {data.pendingAcknowledgement} warning(s) waiting for your acknowledgement.
            </div>
          )}
          <div className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {data.byCategory.map((c) => (
              <div key={c.category} className="card p-4">
                <p className="text-[13px] font-medium text-slate-500">{titleCase(c.category)}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{c.active}</p>
                <p className="text-xs text-slate-500">active of {c.total}</p>
                <span className={clsx('mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', STAGE_TONE[c.highestStage])}>
                  {c.highestStage ? `Stage ${c.highestStage}` : 'No active stage'}
                </span>
              </div>
            ))}
          </div>

          <Card title="Warning stages" className="mb-6">
            <div className="grid gap-2 sm:grid-cols-4">
              {Object.entries(WARNING_STAGES).map(([stage, label]) => (
                <div key={stage} className={clsx('rounded-lg px-3 py-2 text-sm font-medium', STAGE_TONE[stage])}>
                  Stage {stage}: {label}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">A new warning in the same category moves to the next stage while earlier ones are still active (not expired or withdrawn).</p>
          </Card>

          {!data.warnings.length && <EmptyState icon={ShieldCheck} title="Clean record" message="You have no warnings." />}
          <div className="space-y-3">
            {data.warnings.map((w) => (
              <Card key={w._id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', STAGE_TONE[w.stage])}>
                        Stage {w.stage} · {w.stageLabel}
                      </span>
                      <Badge color="gray" dot={false}>
                        {titleCase(w.category)}
                      </Badge>
                      <Badge status={w.effectiveStatus} />
                    </div>
                    <p className="mt-2 font-semibold text-slate-900">{w.reason}</p>
                    <p className="text-xs text-slate-500">
                      {w.refNo} · issued {formatDate(w.issuedDate)} by {getFullName(w.issuedBy)}
                      {w.expiresOn ? ` · valid until ${formatDate(w.expiresOn)}` : ''}
                    </p>
                  </div>
                  {w.status === 'issued' && (
                    <Button size="sm" onClick={() => { setComment(''); setAgreed(false); setAcking(w); }}>
                      Read & acknowledge
                    </Button>
                  )}
                </div>
                {w.details && <p className="mt-3 text-sm text-slate-700">{w.details}</p>}
                {w.expectations && (
                  <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                    <span className="font-medium">Expected: </span>
                    {w.expectations}
                  </p>
                )}
                {w.acknowledgedAt && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Acknowledged {formatDateTime(w.acknowledgedAt)}
                    {w.employeeComment ? ` — “${w.employeeComment}”` : ''}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal
        open={Boolean(acking)}
        onClose={() => setAcking(null)}
        size="lg"
        title={acking ? `${acking.stageLabel} — ${acking.refNo}` : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAcking(null)}>
              Cancel
            </Button>
            <Button disabled={!agreed} loading={saving} onClick={acknowledge}>
              Acknowledge electronically
            </Button>
          </>
        }
      >
        {acking && (
          <div className="space-y-4 text-sm">
            <p className="font-semibold">{acking.reason}</p>
            {acking.details && <p className="text-slate-700">{acking.details}</p>}
            {acking.expectations && <p className="rounded-lg bg-slate-50 p-2">Expected: {acking.expectations}</p>}
            <Textarea label="Your response (optional)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              label="I confirm that I have received and read this warning"
              description="Acknowledging confirms receipt; it does not mean you agree. You can add your response above."
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
