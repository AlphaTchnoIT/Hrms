'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { EyeOff, Lightbulb, Lock, Plus } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { useTabParam } from '@/hooks/useTabParam';
import { GRIEVANCE_CATEGORIES, GRIEVANCE_STATUS, SUGGESTION_STATUS, SUGGESTION_TYPES } from '@/lib/constants';
import { formatDate, formatDateTime, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui';

function GrievanceForm({ open, onClose, onSaved }) {
  const blank = { category: '', subject: '', description: '', isAnonymous: false };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/support/grievances', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit a grievance"
      description="Confidential — only you and the HR team can see it. Your manager cannot."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="grievance-form" loading={form.submitting}>
            Submit confidentially
          </Button>
        </>
      }
    >
      <form id="grievance-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Select label="Category" required options={GRIEVANCE_CATEGORIES} {...form.register('category')} />
        <Input label="Subject" required {...form.register('subject')} />
        <Textarea label="Describe the issue" required rows={5} maxLength={5000} {...form.register('description')} />
        <Checkbox label="Submit anonymously" description="HR will not see your name. You can still follow up here." {...form.register('isAnonymous', { type: 'checkbox' })} />
      </form>
    </Modal>
  );
}

function GrievanceCard({ g, isHR, onChanged }) {
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState(g.status);
  const [resolution, setResolution] = useState(g.resolution || '');
  const [expanded, setExpanded] = useState(false);

  const run = async (fn) => {
    try {
      const res = await fn();
      toast.success(res.message);
      onChanged();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  };

  return (
    <Card>
      <button type="button" className="flex w-full flex-wrap items-start justify-between gap-2 text-left" onClick={() => setExpanded((v) => !v)}>
        <div>
          <p className="font-semibold text-slate-900">{g.subject}</p>
          <p className="text-xs text-slate-500">
            {g.refNo} · {titleCase(g.category)} · {formatDate(g.createdAt)} ·{' '}
            {g.isOwner ? 'submitted by you' : g.submittedBy ? getFullName(g.submittedBy) : 'Anonymous'}
            {g.isAnonymous && <EyeOff className="ml-1 inline h-3 w-3" />}
          </p>
        </div>
        <Badge status={g.status} />
      </button>
      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm">{g.description}</p>
          {g.responses.map((r) => (
            <div key={r._id} className="rounded-lg bg-brand-50 p-3 text-sm">
              <p className="text-xs font-medium text-slate-500">
                {r.fromEmployee ? 'Employee (anonymous)' : getFullName(r.by)} · {formatDateTime(r.createdAt)}
              </p>
              <p className="mt-1">{r.message}</p>
            </div>
          ))}
          {g.resolution && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">Resolution: {g.resolution}</p>}
          {g.status !== 'closed' && (
            <div className="flex gap-2">
              <input className="form-control" placeholder="Write a message…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <Button disabled={!reply.trim()} onClick={() => run(() => api.post(`/support/grievances/${g._id}/responses`, { message: reply })).then((ok) => ok && setReply(''))}>
                Send
              </Button>
            </div>
          )}
          {isHR && !g.isOwner && (
            <div className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
              <Select label="Status" placeholder={false} options={GRIEVANCE_STATUS} value={status} onChange={(e) => setStatus(e.target.value)} />
              <Input label="Resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} />
              <Button onClick={() => run(() => api.patch(`/support/grievances/${g._id}`, { status, resolution }))}>Save</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function SuggestionForm({ open, onClose, onSaved }) {
  const blank = { type: 'suggestion', title: '', description: '' };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/support/suggestions', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share feedback or an idea"
      description="Goes directly to the management team"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="suggestion-form" loading={form.submitting}>
            Submit
          </Button>
        </>
      }
    >
      <form id="suggestion-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Select label="Type" placeholder={false} options={SUGGESTION_TYPES} {...form.register('type')} />
        <Input label="Title" required {...form.register('title')} />
        <Textarea label="Details" required rows={4} maxLength={3000} {...form.register('description')} />
      </form>
    </Modal>
  );
}

function SuggestionCard({ s, canRespond, onChanged }) {
  const [status, setStatus] = useState(s.status);
  const [response, setResponse] = useState(s.response || '');
  const save = async () => {
    try {
      const res = await api.patch(`/support/suggestions/${s._id}`, { status, response });
      toast.success(res.message);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{s.title}</p>
          <p className="text-xs text-slate-500">
            {titleCase(s.type)} · {formatDate(s.createdAt)}
            {canRespond && s.submittedBy ? ` · ${getFullName(s.submittedBy)}` : ''}
          </p>
        </div>
        <Badge status={s.status} />
      </div>
      <p className="mt-2 text-sm text-slate-700">{s.description}</p>
      {s.response && !canRespond && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-sm">Management: {s.response}</p>}
      {canRespond && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-end">
          <Select label="Status" placeholder={false} options={SUGGESTION_STATUS} value={status} onChange={(e) => setStatus(e.target.value)} />
          <Input label="Response" value={response} onChange={(e) => setResponse(e.target.value)} />
          <Button onClick={save}>Save</Button>
        </div>
      )}
    </Card>
  );
}

export default function SupportPage() {
  const { isHR } = useAuth();
  const [tab, setTab] = useTabParam('grievances', ['grievances', 'suggestions']);
  const [scope, setScope] = useState('all');
  const [modal, setModal] = useState(null);
  const grievances = useFetch(tab === 'grievances' ? '/support/grievances' : null, { params: { scope: isHR ? scope : 'mine' } });
  const suggestions = useFetch(tab === 'suggestions' ? '/support/suggestions' : null, { params: { scope: isHR ? scope : 'mine' } });

  return (
    <div>
      <PageHeader
        title="Grievances & Ideas"
        subtitle="Confidential grievances and feedback, ideas and suggestions for management"
        actions={
          tab === 'grievances' ? (
            <Button icon={Lock} onClick={() => setModal('grievance')}>
              Submit grievance
            </Button>
          ) : (
            <Button icon={Plus} onClick={() => setModal('suggestion')}>
              Share an idea
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'grievances', label: 'Grievances' },
            { value: 'suggestions', label: 'Feedback & suggestions' },
          ]}
        />
        {isHR && (
          <Tabs
            value={scope}
            onChange={setScope}
            tabs={[
              { value: 'all', label: 'All submissions' },
              { value: 'mine', label: 'Mine' },
            ]}
          />
        )}
      </div>

      {tab === 'grievances' && (
        <div className="space-y-3">
          {!grievances.loading && !grievances.data?.length && <EmptyState icon={Lock} message="No grievances." />}
          {(grievances.data || []).map((g) => (
            <GrievanceCard key={g._id} g={g} isHR={isHR} onChanged={grievances.refetch} />
          ))}
        </div>
      )}
      {tab === 'suggestions' && (
        <div className="grid gap-3 lg:grid-cols-2">
          {!suggestions.loading && !suggestions.data?.length && <EmptyState icon={Lightbulb} message="No submissions yet." />}
          {(suggestions.data || []).map((s) => (
            <SuggestionCard key={s._id} s={s} canRespond={isHR && scope === 'all'} onChanged={suggestions.refetch} />
          ))}
        </div>
      )}

      <GrievanceForm open={modal === 'grievance'} onClose={() => setModal(null)} onSaved={grievances.refetch} />
      <SuggestionForm open={modal === 'suggestion'} onClose={() => setModal(null)} onSaved={suggestions.refetch} />
    </div>
  );
}
