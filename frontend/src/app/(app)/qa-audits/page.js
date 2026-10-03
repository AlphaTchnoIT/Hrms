'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useTabParam } from '@/hooks/useTabParam';
import { AUDITOR_ROLES, INTERACTION_CHANNELS, QA_ERROR_CATEGORIES } from '@/lib/constants';
import { formatDate, formatDateTime, getFullName, titleCase, toInputDate } from '@/lib/format';
import { Badge, Button, Card, Checkbox, DataTable, ErrorMessage, Input, Modal, PageHeader, Select, Tabs, Textarea, useConfirm } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';

const blankAudit = () => ({ user: '', interactionRef: '', auditDate: toInputDate(), score: '', isFatal: false, errorCategories: [], strengths: '', improvements: '', comments: '' });

function AuditModal({ open, onClose, options, onSaved }) {
  const form = useForm(blankAudit());
  const { register, values, setField } = form;
  useEffect(() => {
    if (open) form.reset(blankAudit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (c) => setField('errorCategories', values.errorCategories.includes(c) ? values.errorCategories.filter((x) => x !== c) : [...values.errorCategories, c]);
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/quality/feedback', { ...data, score: data.score === '' ? undefined : Number(data.score) });
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Record QA audit"
      description="The employee is notified and must acknowledge. The weekly QA score updates automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="audit-form" loading={form.submitting}>
            Save audit
          </Button>
        </>
      }
    >
      <form id="audit-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Employee" required options={options} {...register('user')} />
          <Input label="Interaction reference" placeholder="e.g. INT-1042" {...register('interactionRef')} />
          <Input label="Audit date" type="date" required max={toInputDate()} {...register('auditDate')} />
          <Input label="Score (%)" type="number" min="0" max="100" required {...register('score')} />
        </div>
        <Checkbox label="Fatal error" description="A fatal error counts as 0 in the weekly QA score" {...register('isFatal', { type: 'checkbox' })} />
        <div>
          <p className="form-label">Error categories</p>
          <div className="flex flex-wrap gap-2">
            {QA_ERROR_CATEGORIES.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => toggle(c)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${values.errorCategories.includes(c) ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-300 text-slate-600'}`}
              >
                {titleCase(c)}
              </button>
            ))}
          </div>
          {form.errors.errorCategories && <p className="mt-1 text-xs font-medium text-red-600">{form.errors.errorCategories}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea label="Strengths" rows={2} {...register('strengths')} />
          <Textarea label="Areas of improvement" rows={2} {...register('improvements')} />
        </div>
        <Textarea label="Comments" rows={2} {...register('comments')} />
      </form>
    </Modal>
  );
}

function InteractionModal({ open, onClose, options, onSaved }) {
  const blank = { reference: '', agent: '', channel: 'call', customerName: '', summary: '', recordingUrl: '', resolvedAt: toInputDate() };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/quality/interactions', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log resolved interaction"
      description="Resolved interactions form the pool used for random calibration."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="interaction-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="interaction-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Reference" required {...form.register('reference')} />
        <Select label="Agent" required options={options} {...form.register('agent')} />
        <Select label="Channel" placeholder={false} options={INTERACTION_CHANNELS} {...form.register('channel')} />
        <Input label="Resolved on" type="date" required max={toInputDate()} {...form.register('resolvedAt')} />
        <Input label="Customer" {...form.register('customerName')} />
        <Input label="Recording link" {...form.register('recordingUrl')} />
        <Textarea label="Summary" className="sm:col-span-2" rows={2} {...form.register('summary')} />
      </form>
    </Modal>
  );
}

export default function QaAuditsPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useTabParam('audits', ['audits', 'repeated', 'interactions']);
  const [member, setMember] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [modal, setModal] = useState(null);
  const { options } = useTeamMembers();
  const audits = useFetch(tab === 'audits' ? '/quality/feedback' : null, { params: { user: member || undefined, pending: pendingOnly || undefined } });
  const repeated = useFetch(tab === 'repeated' ? '/quality/repeated-errors' : null, { params: { days: 90 } });
  const interactions = useFetch(tab === 'interactions' ? '/quality/interactions' : null, { params: { agent: member || undefined } });

  const remove = async (f) => {
    if (!(await confirm({ title: 'Delete this audit?', message: 'The weekly QA score will be recalculated.', confirmText: 'Delete', danger: true }))) return;
    try {
      await api.delete(`/quality/feedback/${f._id}`);
      toast.success('Audit deleted');
      audits.refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const auditColumns = [
    { key: 'date', header: 'Date', render: (f) => formatDate(f.auditDate) },
    { key: 'employee', header: 'Employee', render: (f) => <EmployeeCell employee={f.user} /> },
    { key: 'ref', header: 'Interaction', render: (f) => f.interactionRef || '—' },
    { key: 'score', header: 'Score', render: (f) => (f.isFatal ? <Badge color="red">Fatal (0)</Badge> : <strong>{f.score}%</strong>) },
    { key: 'errors', header: 'Errors', className: 'whitespace-normal', render: (f) => f.errorCategories.map(titleCase).join(', ') || '—' },
    { key: 'auditor', header: 'Auditor', render: (f) => getFullName(f.auditor) },
    { key: 'ack', header: 'Acknowledged', render: (f) => (f.acknowledgedAt ? <Badge status="acknowledged">{formatDate(f.acknowledgedAt)}</Badge> : <Badge status="pending" />) },
    { key: 'del', header: '', render: (f) => <Button size="xs" variant="ghost" icon={Trash2} label="Delete audit" onClick={() => remove(f)} /> },
  ];
  const repeatedColumns = [
    { key: 'employee', header: 'Employee', render: (r) => <EmployeeCell employee={r.user} /> },
    { key: 'category', header: 'Error category', render: (r) => titleCase(r.category) },
    { key: 'count', header: 'Times (90 days)', render: (r) => <strong className={r.count >= 4 ? 'text-rose-600' : 'text-amber-600'}>{r.count}</strong> },
    { key: 'last', header: 'Last seen', render: (r) => formatDate(r.lastDate) },
    { key: 'unack', header: 'Unacknowledged', render: (r) => r.unacknowledged || '—' },
  ];
  const interactionColumns = [
    { key: 'ref', header: 'Reference', render: (i) => <strong>{i.reference}</strong> },
    { key: 'agent', header: 'Agent', render: (i) => <EmployeeCell employee={i.agent} /> },
    { key: 'channel', header: 'Channel', render: (i) => titleCase(i.channel) },
    { key: 'customer', header: 'Customer', render: (i) => i.customerName || '—' },
    { key: 'resolved', header: 'Resolved', render: (i) => formatDateTime(i.resolvedAt) },
    { key: 'summary', header: 'Summary', className: 'whitespace-normal', render: (i) => i.summary || '—' },
  ];

  return (
    <RoleGuard roles={AUDITOR_ROLES}>
      <PageHeader
        title="QA Audits"
        subtitle="Record QA feedback against employees and track repeated errors"
        actions={
          <>
            <Button variant="secondary" icon={Plus} onClick={() => setModal('interaction')}>
              Log interaction
            </Button>
            <Button icon={Plus} onClick={() => setModal('audit')}>
              Record audit
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'audits', label: 'Audits' },
            { value: 'repeated', label: 'Repeated errors' },
            { value: 'interactions', label: 'Interactions' },
          ]}
        />
        {tab !== 'repeated' && <Select className="w-64" placeholder="All employees" options={options} value={member} onChange={(e) => setMember(e.target.value)} />}
        {tab === 'audits' && <Checkbox label="Not acknowledged only" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} />}
      </div>

      {tab === 'audits' && (
        <Card noPadding>
          <ErrorMessage message={audits.error} />
          <DataTable columns={auditColumns} rows={audits.data} loading={audits.loading} emptyMessage="No audits" />
        </Card>
      )}
      {tab === 'repeated' && (
        <Card noPadding title="Repeated errors" subtitle="Same error category 2 or more times in the last 90 days">
          <DataTable columns={repeatedColumns} rows={repeated.data} loading={repeated.loading} rowKey={(r) => `${r.user?._id}-${r.category}`} emptyMessage="No repeated errors 🎉" />
        </Card>
      )}
      {tab === 'interactions' && (
        <Card noPadding>
          <DataTable columns={interactionColumns} rows={interactions.data} loading={interactions.loading} emptyMessage="No interactions logged" />
        </Card>
      )}

      <AuditModal open={modal === 'audit'} onClose={() => setModal(null)} options={options} onSaved={audits.refetch} />
      <InteractionModal open={modal === 'interaction'} onClose={() => setModal(null)} options={options} onSaved={interactions.refetch} />
    </RoleGuard>
  );
}
