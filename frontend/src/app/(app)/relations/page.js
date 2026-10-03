'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Flag, Plus, Siren, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useQueryValue, useTabParam } from '@/hooks/useTabParam';
import { APPROVER_ROLES, ESCALATION_STATUS, KPI_METRICS, METRIC_LABELS, TRIGGER_TYPES, WARNING_CATEGORIES, WARNING_STAGES } from '@/lib/constants';
import { formatDate, formatDateTime, getFullName, titleCase, toInputDate } from '@/lib/format';
import { Badge, Button, Card, Checkbox, DataTable, EmptyState, Input, Modal, PageHeader, Select, Tabs, Textarea, useConfirm } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';

const STAGE_COLOR = { 1: 'yellow', 2: 'yellow', 3: 'red', 4: 'red' };

function EscalationModal({ open, onClose, options, employee, onSaved }) {
  const blank = { employee: employee || '', category: '', incident: '', incidentDate: toInputDate(), evidence: '', expectations: '', followUpDate: '' };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset({ ...blank, employee: employee || '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/relations/escalations', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Raise escalation"
      description="Document the incident, evidence, expectations and the follow-up."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="esc-form" loading={form.submitting}>
            Raise escalation
          </Button>
        </>
      }
    >
      <form id="esc-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select label="Employee" required options={options} {...form.register('employee')} />
        <Select label="Category" required options={WARNING_CATEGORIES} {...form.register('category')} />
        <Textarea label="Incident" required className="sm:col-span-2" maxLength={3000} {...form.register('incident')} />
        <Input label="Incident date" type="date" required max={toInputDate()} {...form.register('incidentDate')} />
        <Input label="Follow-up date" type="date" {...form.register('followUpDate')} />
        <Textarea label="Evidence" className="sm:col-span-2" rows={2} placeholder="Audit references, screenshots links, reports…" {...form.register('evidence')} />
        <Textarea label="Expectations" className="sm:col-span-2" rows={2} {...form.register('expectations')} />
      </form>
    </Modal>
  );
}

function WarningModal({ open, onClose, options, employee, escalations, onSaved }) {
  const { isHR } = useAuth();
  const blank = { employee: employee || '', category: '', stage: '', reason: '', details: '', expectations: '', issuedDate: toInputDate(), expiresOn: toInputDate(new Date(Date.now() + 180 * 86400000)), escalation: '' };
  const form = useForm(blank);
  const { values } = form;
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    if (open) {
      form.reset({ ...blank, employee: employee || '' });
      setSuggestion(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee]);

  // Suggest the next stage for this employee and category
  useEffect(() => {
    if (!open || !values.employee || !values.category) return;
    api
      .get('/relations/warnings/suggest-stage', { params: { employee: values.employee, category: values.category } })
      .then((res) => {
        setSuggestion(res.data);
        form.setField('stage', String(res.data.stage));
      })
      .catch(() => setSuggestion(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, values.employee, values.category]);

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/relations/warnings', { ...data, stage: data.stage ? Number(data.stage) : undefined });
    toast.success(res.message);
    onSaved();
    onClose();
  });

  const stageOptions = Object.entries(WARNING_STAGES)
    .filter(([s]) => isHR || !suggestion || Number(s) <= suggestion.stage)
    .map(([s, label]) => ({ value: s, label: `Stage ${s} – ${label}` }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Issue warning"
      description="The employee receives it in their portal and must acknowledge electronically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="warning-form" variant="danger" loading={form.submitting}>
            Issue warning
          </Button>
        </>
      }
    >
      <form id="warning-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select label="Employee" required options={options} {...form.register('employee')} />
        <Select label="Category" required options={WARNING_CATEGORIES} {...form.register('category')} />
        {suggestion && (
          <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
            Next stage for this category: <strong>Stage {suggestion.stage} – {suggestion.label}</strong>
            {suggestion.active.length > 0 && (
              <span className="block text-xs">
                Active: {suggestion.active.map((w) => `${w.refNo} (${titleCase(w.category)} stage ${w.stage})`).join(', ')}
              </span>
            )}
          </div>
        )}
        <Select label="Stage" placeholder="Auto (next stage)" options={stageOptions} hint={isHR ? 'HR may skip stages for serious misconduct' : undefined} {...form.register('stage')} />
        <Select
          label="Linked escalation"
          placeholder="None"
          options={(escalations || []).filter((e) => e.employee?._id === values.employee).map((e) => ({ value: e._id, label: `${e.refNo} – ${e.incident.slice(0, 40)}` }))}
          {...form.register('escalation')}
        />
        <Input label="Reason" required className="sm:col-span-2" {...form.register('reason')} />
        <Textarea label="Details" className="sm:col-span-2" rows={3} {...form.register('details')} />
        <Textarea label="Expectations" className="sm:col-span-2" rows={2} {...form.register('expectations')} />
        <Input label="Issue date" type="date" required max={toInputDate()} {...form.register('issuedDate')} />
        <Input label="Valid until" type="date" hint="After this the warning no longer counts" {...form.register('expiresOn')} />
      </form>
    </Modal>
  );
}

function EscalationUpdateModal({ escalation, onClose, onSaved }) {
  const form = useForm({ status: escalation.status, outcome: escalation.outcome || '', followUpDate: escalation.followUpDate || '', note: '' });
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.patch(`/relations/escalations/${escalation._id}`, data);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${escalation.refNo} · ${getFullName(escalation.employee)}`}
      description={escalation.incident}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" form="esc-update" loading={form.submitting}>
            Save update
          </Button>
        </>
      }
    >
      <div className="mb-4 space-y-2 text-sm">
        {escalation.evidence && <p><strong>Evidence:</strong> {escalation.evidence}</p>}
        {escalation.expectations && <p><strong>Expectations:</strong> {escalation.expectations}</p>}
      </div>
      <form id="esc-update" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select label="Status" placeholder={false} options={ESCALATION_STATUS} {...form.register('status')} />
        <Input label="Follow-up date" type="date" {...form.register('followUpDate')} />
        <Textarea label="Note" rows={2} className="sm:col-span-2" {...form.register('note')} />
        <Textarea label="Outcome" rows={2} className="sm:col-span-2" {...form.register('outcome')} />
      </form>
      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Audit trail</p>
        <ol className="space-y-2 text-sm">
          {[...escalation.history].reverse().map((h, i) => (
            <li key={i} className="border-l-2 border-slate-200 pl-3">
              <p className="font-medium text-slate-800">{h.action}</p>
              {h.note && <p className="text-slate-600">{h.note}</p>}
              <p className="text-xs text-slate-400">
                {getFullName(h.by)} · {formatDateTime(h.at)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}

function TriggersTab() {
  const { isHR } = useAuth();
  const confirm = useConfirm();
  const triggers = useFetch('/relations/triggers');
  const flags = useFetch('/relations/flags');
  const [editing, setEditing] = useState(undefined);
  const form = useForm({ name: '', type: 'late-logins', metric: '', threshold: 3, windowDays: 30, category: 'attendance', isActive: true });

  useEffect(() => {
    if (editing !== undefined) form.reset(editing ? { ...editing, metric: editing.metric || '' } : { name: '', type: 'late-logins', metric: '', threshold: 3, windowDays: 30, category: 'attendance', isActive: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const onSubmit = form.handleSubmit(async (data) => {
    const payload = { name: data.name, type: data.type, metric: data.metric, threshold: Number(data.threshold), windowDays: Number(data.windowDays), category: data.category, isActive: data.isActive };
    const res = editing ? await api.put(`/relations/triggers/${editing._id}`, payload) : await api.post('/relations/triggers', payload);
    toast.success(res.message);
    setEditing(undefined);
    triggers.refetch();
    flags.refetch();
  });

  const remove = async (t) => {
    if (!(await confirm({ title: 'Delete trigger?', message: t.name, confirmText: 'Delete', danger: true }))) return;
    await api.delete(`/relations/triggers/${t._id}`);
    triggers.refetch();
    flags.refetch();
  };

  const triggerColumns = [
    { key: 'name', header: 'Trigger', render: (t) => <strong>{t.name}</strong> },
    { key: 'rule', header: 'Rule', render: (t) => `${t.threshold}+ ${titleCase(t.type)}${t.metric ? ` (${METRIC_LABELS[t.metric]})` : ''} in ${t.windowDays} days` },
    { key: 'category', header: 'Warning category', render: (t) => titleCase(t.category) },
    { key: 'active', header: 'Active', render: (t) => <Badge color={t.isActive ? 'green' : 'gray'}>{t.isActive ? 'Active' : 'Off'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (t) =>
        isHR && (
          <div className="flex gap-1">
            <Button size="xs" variant="secondary" onClick={() => setEditing(t)}>
              Edit
            </Button>
            <Button size="xs" variant="ghost" icon={Trash2} label="Delete" onClick={() => remove(t)} />
          </div>
        ),
    },
  ];
  const flagColumns = [
    { key: 'employee', header: 'Employee', render: (f) => <EmployeeCell employee={f.user} /> },
    { key: 'trigger', header: 'Trigger', render: (f) => f.trigger.name },
    { key: 'message', header: 'Detail', className: 'whitespace-normal', render: (f) => f.message },
    { key: 'category', header: 'Suggested category', render: (f) => <Badge color="red">{titleCase(f.trigger.category)}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <Card noPadding title="Flagged for manager review" subtitle="Employees who breached a trigger rule" icon={Flag}>
        <DataTable columns={flagColumns} rows={flags.data} loading={flags.loading} rowKey={(f) => `${f.user?._id}-${f.trigger._id}`} emptyMessage="Nobody is flagged right now" />
      </Card>
      <Card
        noPadding
        title="Warning triggers"
        subtitle="Configurable patterns: KPI failures, attendance breaches, repeated QA errors"
        action={
          isHR && (
            <Button size="sm" icon={Plus} onClick={() => setEditing(null)}>
              Add trigger
            </Button>
          )
        }
      >
        <DataTable columns={triggerColumns} rows={triggers.data} loading={triggers.loading} />
      </Card>
      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? 'Edit trigger' : 'New trigger'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(undefined)}>
              Cancel
            </Button>
            <Button type="submit" form="trigger-form" loading={form.submitting}>
              Save
            </Button>
          </>
        }
      >
        <form id="trigger-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Input label="Name" required className="sm:col-span-2" {...form.register('name')} />
          <Select label="Type" placeholder={false} options={TRIGGER_TYPES} {...form.register('type')} />
          {form.values.type === 'kpi-failure' && <Select label="KPI" options={KPI_METRICS.map((m) => ({ value: m, label: METRIC_LABELS[m] }))} {...form.register('metric')} />}
          <Input label="Threshold (times)" type="number" min="1" {...form.register('threshold')} />
          <Input label="Window (days)" type="number" min="1" max="365" {...form.register('windowDays')} />
          <Select label="Warning category" placeholder={false} options={WARNING_CATEGORIES} {...form.register('category')} />
          <Checkbox label="Active" {...form.register('isActive', { type: 'checkbox' })} />
        </form>
      </Modal>
    </div>
  );
}

function HistoryTab({ options, employee, setEmployee }) {
  const { data, loading } = useFetch(employee ? `/relations/history/${employee}` : null);
  const COLORS = { escalation: 'purple', warning: 'red', 'action-plan': 'blue', qa: 'yellow' };
  return (
    <div>
      <Select className="mb-4 w-72" placeholder="Select an employee" options={options} value={employee} onChange={(e) => setEmployee(e.target.value)} />
      {!employee && <EmptyState message="Select an employee to see their auditable history." />}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      {data && (
        <Card title={`History of ${getFullName(data.employee)}`} subtitle="Escalations, warnings, acknowledgements, actions and outcomes">
          {!data.events.length && <p className="text-sm text-slate-500">No events.</p>}
          <ol className="space-y-3">
            {data.events.map((e, i) => (
              <li key={i} className="flex gap-3 border-l-2 border-slate-200 pl-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={COLORS[e.type]} dot={false}>
                      {titleCase(e.type)}
                    </Badge>
                    <span className="font-medium text-slate-800">{e.title}</span>
                    {e.stage && <Badge color={STAGE_COLOR[e.stage]}>Stage {e.stage}</Badge>}
                  </div>
                  {e.note && <p className="mt-0.5 text-sm text-slate-600">{e.note}</p>}
                  <p className="text-xs text-slate-400">
                    {e.ref} · {e.by ? `${getFullName(e.by)} · ` : ''}
                    {formatDateTime(e.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

export default function RelationsPage() {
  const { isHR } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useTabParam('escalations', ['escalations', 'warnings', 'triggers', 'history']);
  const employeeParam = useQueryValue('employee');
  const [employee, setEmployee] = useState('');
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const { options } = useTeamMembers();

  useEffect(() => {
    if (employeeParam) setEmployee(employeeParam);
  }, [employeeParam]);

  const escalations = useFetch('/relations/escalations', { params: { employee: tab === 'escalations' ? employee || undefined : undefined } });
  const warnings = useFetch(tab === 'warnings' ? '/relations/warnings' : null, { params: { employee: employee || undefined } });

  const withdraw = async (w) => {
    if (!(await confirm({ title: `Withdraw ${w.refNo}?`, message: 'The warning will no longer count towards the next stage.', confirmText: 'Withdraw', danger: true }))) return;
    try {
      await api.patch(`/relations/warnings/${w._id}/withdraw`, { note: 'Withdrawn' });
      toast.success('Warning withdrawn');
      warnings.refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const escalationColumns = [
    { key: 'ref', header: 'Ref', render: (e) => <strong>{e.refNo}</strong> },
    { key: 'employee', header: 'Employee', render: (e) => <EmployeeCell employee={e.employee} /> },
    { key: 'category', header: 'Category', render: (e) => titleCase(e.category) },
    { key: 'incident', header: 'Incident', className: 'max-w-xs whitespace-normal', render: (e) => e.incident },
    { key: 'date', header: 'Incident date', render: (e) => formatDate(e.incidentDate) },
    { key: 'followUp', header: 'Follow-up', render: (e) => (e.followUpDate ? formatDate(e.followUpDate) : '—') },
    { key: 'raised', header: 'Raised by', render: (e) => getFullName(e.raisedBy) },
    { key: 'status', header: 'Status', render: (e) => <Badge status={e.status} /> },
    { key: 'open', header: '', render: (e) => <Button size="xs" variant="secondary" onClick={() => setSelected(e)}>Open</Button> },
  ];
  const warningColumns = [
    { key: 'ref', header: 'Ref', render: (w) => <strong>{w.refNo}</strong> },
    { key: 'employee', header: 'Employee', render: (w) => <EmployeeCell employee={w.employee} /> },
    { key: 'category', header: 'Category', render: (w) => titleCase(w.category) },
    { key: 'stage', header: 'Stage', render: (w) => <Badge color={STAGE_COLOR[w.stage]}>{`${w.stage} · ${w.stageLabel}`}</Badge> },
    { key: 'reason', header: 'Reason', className: 'max-w-xs whitespace-normal', render: (w) => w.reason },
    { key: 'issued', header: 'Issued', render: (w) => formatDate(w.issuedDate) },
    { key: 'status', header: 'Status', render: (w) => <Badge status={w.effectiveStatus} /> },
    { key: 'ack', header: 'Acknowledged', render: (w) => (w.acknowledgedAt ? formatDateTime(w.acknowledgedAt) : '—') },
    { key: 'actions', header: '', render: (w) => w.isActive && <Button size="xs" variant="ghost" onClick={() => withdraw(w)}>Withdraw</Button> },
  ];

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Employee Relations"
        subtitle={isHR ? 'Escalations, warnings and conduct across the company' : 'Escalations, warnings and conduct for your team'}
        actions={
          <>
            <Button variant="secondary" icon={Siren} onClick={() => setModal('escalation')}>
              Raise escalation
            </Button>
            <Button variant="danger" icon={Plus} onClick={() => setModal('warning')}>
              Issue warning
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'escalations', label: 'Escalations' },
            { value: 'warnings', label: 'Warnings' },
            { value: 'triggers', label: 'Triggers & flags' },
            { value: 'history', label: 'History' },
          ]}
        />
        {['escalations', 'warnings'].includes(tab) && (
          <Select className="w-64" placeholder="All employees" options={options} value={employee} onChange={(e) => setEmployee(e.target.value)} />
        )}
      </div>

      {tab === 'escalations' && (
        <Card noPadding>
          <DataTable columns={escalationColumns} rows={escalations.data} loading={escalations.loading} emptyMessage="No escalations" />
        </Card>
      )}
      {tab === 'warnings' && (
        <Card noPadding>
          <DataTable columns={warningColumns} rows={warnings.data} loading={warnings.loading} emptyMessage="No warnings" />
        </Card>
      )}
      {tab === 'triggers' && <TriggersTab />}
      {tab === 'history' && <HistoryTab options={options} employee={employee} setEmployee={setEmployee} />}

      <EscalationModal open={modal === 'escalation'} onClose={() => setModal(null)} options={options} employee={employee} onSaved={escalations.refetch} />
      <WarningModal
        open={modal === 'warning'}
        onClose={() => setModal(null)}
        options={options}
        employee={employee}
        escalations={escalations.data}
        onSaved={() => {
          warnings.refetch();
          setTab('warnings');
        }}
      />
      {selected && <EscalationUpdateModal escalation={selected} onClose={() => setSelected(null)} onSaved={escalations.refetch} />}
    </RoleGuard>
  );
}
