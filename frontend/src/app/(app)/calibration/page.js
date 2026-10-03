'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCheck, Crosshair, Shuffle, Target } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { AUDITOR_ROLES } from '@/lib/constants';
import { formatDateTime, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Card, DataTable, EmptyState, ErrorMessage, Input, Modal, PageHeader, PageLoader, Select, StatCard, Tabs, Textarea } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';

function AuditBox({ title, audit, signOff }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {audit?.score !== undefined && audit?.score !== null ? (
        <>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{audit.score}%</p>
          <p className="text-xs text-slate-500">{getFullName(audit.auditor)} · {formatDateTime(audit.at)}</p>
          {audit.notes && <p className="mt-1 text-sm text-slate-600">{audit.notes}</p>}
        </>
      ) : audit?.submitted ? (
        <p className="mt-2 text-sm text-slate-600">Submitted — hidden until you submit yours (blind audit)</p>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Waiting for audit</p>
      )}
      {signOff?.by && <p className="mt-2 text-xs font-medium text-emerald-700">✓ Signed off by {getFullName(signOff.by)}</p>}
    </div>
  );
}

export default function CalibrationPage() {
  const { user, isAdmin } = useAuth();
  const [status, setStatus] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [selecting, setSelecting] = useState(false);
  const [action, setAction] = useState(null); // { type: 'audit' | 'sign-off', calibration }
  const [form, setForm] = useState({ score: '', notes: '', side: 'qa' });
  const [saving, setSaving] = useState(false);
  const list = useFetch('/quality/calibrations', { params: { status: status || undefined } });
  const summary = useFetch('/quality/calibrations/summary');
  const mySide = user?.role === 'qa' ? 'qa' : 'manager';

  const refresh = () => {
    list.refetch();
    summary.refetch();
  };

  const select = async () => {
    setSelecting(true);
    try {
      const res = await api.post('/quality/calibrations/select', { frequency });
      toast.success(res.message);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSelecting(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { calibration, type } = action;
      const side = isAdmin ? { side: form.side } : {};
      const res =
        type === 'audit'
          ? await api.post(`/quality/calibrations/${calibration._id}/audit`, { score: Number(form.score), notes: form.notes, ...side })
          : await api.post(`/quality/calibrations/${calibration._id}/sign-off`, { agreedScore: Number(form.score), comment: form.notes, ...side });
      toast.success(res.message);
      setAction(null);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const s = summary.data;
  const auditorColumns = [
    { key: 'auditor', header: 'Auditor', render: (a) => getFullName(a.auditor) },
    { key: 'side', header: 'Side', render: (a) => (a.side === 'qa' ? 'QA' : 'Manager') },
    { key: 'count', header: 'Calibrations', render: (a) => a.count },
    { key: 'accuracy', header: 'Avg accuracy', render: (a) => `${a.averageAccuracy}%` },
    { key: 'aligned', header: 'Aligned', render: (a) => `${a.alignedPercent}%` },
  ];

  const openAction = (type, c) => {
    setForm({ score: type === 'sign-off' ? String(c.agreedScore ?? Math.round(((c.managerAudit?.score ?? 0) + (c.qaAudit?.score ?? 0)) / 2)) : '', notes: '', side: 'qa' });
    setAction({ type, calibration: c });
  };

  const mineDone = (c) => (mySide === 'qa' ? c.qaAudit?.score !== undefined && c.qaAudit?.score !== null : c.managerAudit?.score !== undefined && c.managerAudit?.score !== null);
  const mySigned = (c) => (mySide === 'qa' ? c.qaSignOff?.by : c.managerSignOff?.by);

  return (
    <RoleGuard roles={AUDITOR_ROLES}>
      <PageHeader
        title="Calibration"
        subtitle="A random resolved interaction is audited independently by the manager and QA; scores are compared and agreed by both teams"
        actions={
          <div className="flex gap-2">
            <Select
              className="w-36"
              placeholder={false}
              options={[
                { value: 'daily', label: 'Daily pick' },
                { value: 'weekly', label: 'Weekly pick' },
              ]}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
            <Button icon={Shuffle} loading={selecting} onClick={select}>
              Pick random interaction
            </Button>
          </div>
        }
      />

      {s && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Average calibration accuracy" value={s.averageAccuracy === null ? '—' : `${s.averageAccuracy}%`} icon={Target} />
          <StatCard label="Aligned" value={s.alignedPercent === null ? '—' : `${s.alignedPercent}%`} hint={`Within ±${s.tolerance} points`} icon={Crosshair} tone="green" />
          <StatCard label="Agreed by both teams" value={`${s.agreed} / ${s.total}`} icon={CheckCheck} tone="blue" />
          <StatCard label="Waiting for audits" value={s.pending} tone="yellow" />
        </div>
      )}

      <Tabs
        className="mb-4"
        value={status}
        onChange={setStatus}
        tabs={[
          { value: '', label: 'All' },
          { value: 'pending', label: 'Waiting for audits' },
          { value: 'scored', label: 'Waiting for agreement' },
          { value: 'agreed', label: 'Agreed' },
        ]}
      />
      <ErrorMessage message={list.error} onRetry={list.refetch} />
      {list.loading && !list.data && <PageLoader />}
      {list.data && !list.data.length && <EmptyState icon={Crosshair} message="No calibrations yet. Pick a random interaction to start." />}

      <div className="space-y-4">
        {(list.data || []).map((c) => (
          <Card key={c._id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {c.interaction?.reference} · {titleCase(c.interaction?.channel || '')}
                </p>
                <p className="text-xs text-slate-500">
                  {titleCase(c.frequency)} calibration · resolved {formatDateTime(c.interaction?.resolvedAt)}
                </p>
                {c.interaction?.summary && <p className="mt-1 text-sm text-slate-600">{c.interaction.summary}</p>}
              </div>
              <div className="flex items-center gap-3">
                <EmployeeCell employee={c.interaction?.agent} subtitle="Agent" />
                <Badge status={c.status} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <AuditBox title="Manager audit" audit={c.managerAudit} signOff={c.managerSignOff} />
              <AuditBox title="QA audit" audit={c.qaAudit} signOff={c.qaSignOff} />
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result</p>
                {c.status === 'pending' ? (
                  <p className="mt-2 text-sm text-slate-500">Available when both audits are in</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm">
                      Variance <strong>{c.variance}</strong> pts · accuracy <strong>{c.accuracy}%</strong>
                    </p>
                    <Badge className="mt-1" color={c.isAligned ? 'green' : 'red'}>
                      {c.isAligned ? 'Aligned' : 'Not aligned'}
                    </Badge>
                    {c.agreedScore !== undefined && c.agreedScore !== null && (
                      <p className="mt-2 text-sm">
                        Agreed score <strong>{c.agreedScore}%</strong>
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              {c.status === 'pending' && (isAdmin || !mineDone(c)) && (
                <Button size="sm" onClick={() => openAction('audit', c)}>
                  Submit my audit
                </Button>
              )}
              {c.status === 'scored' && (isAdmin || !mySigned(c)) && (
                <Button size="sm" variant="success" onClick={() => openAction('sign-off', c)}>
                  Agree final score
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {s?.auditors?.length > 0 && (
        <Card noPadding title="Auditor calibration accuracy" className="mt-6">
          <DataTable columns={auditorColumns} rows={s.auditors} rowKey={(a) => `${a.auditor._id}-${a.side}`} />
        </Card>
      )}

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.type === 'audit' ? 'Independent audit' : 'Agree final score'}
        description={
          action?.type === 'audit'
            ? "Score the interaction without seeing the other side's score."
            : 'Both the QA team and the manager/HR side must sign off the same score. Proposing a different score resets the other sign-off.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={submit}>
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {isAdmin && (
            <Select
              label="Acting as"
              placeholder={false}
              options={[
                { value: 'qa', label: 'QA auditor' },
                { value: 'manager', label: 'Manager' },
              ]}
              value={form.side}
              onChange={(e) => setForm((f) => ({ ...f, side: e.target.value }))}
            />
          )}
          <Input label={action?.type === 'audit' ? 'Score (%)' : 'Agreed score (%)'} type="number" min="0" max="100" value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))} />
          <Textarea label={action?.type === 'audit' ? 'Audit notes' : 'Comment'} rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>
    </RoleGuard>
  );
}
