'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Briefcase, CalendarClock, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useTabParam } from '@/hooks/useTabParam';
import { INTERVIEW_RESULTS } from '@/lib/constants';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import StatusTracker from '@/components/recruitment/StatusTracker';
import { Badge, Button, Card, EmptyState, ErrorMessage, Input, Modal, PageHeader, PageLoader, Select, Tabs, Textarea } from '@/components/ui';

function JobsTab() {
  const { data, loading, error, refetch } = useFetch('/careers/jobs');
  const [applying, setApplying] = useState(null);
  const [form, setForm] = useState({ coverNote: '', resumeUrl: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/careers/jobs/${applying._id}/apply`, form);
      toast.success(res.message);
      setApplying(null);
      refetch();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <PageLoader />;
  return (
    <>
      <ErrorMessage message={error} onRetry={refetch} />
      {!data?.length && <EmptyState icon={Briefcase} message="No internal openings right now." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data || []).map((job) => (
          <Card key={job._id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{job.title}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                  <span>{job.refNo}</span>
                  {job.department?.name && <span>{job.department.name}</span>}
                  {job.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {job.location}
                    </span>
                  )}
                  <span>{job.openings} opening(s)</span>
                </p>
              </div>
              {job.hasApplied ? <Badge status="submitted">Applied</Badge> : job.eligible ? <Badge color="green">Eligible</Badge> : <Badge color="gray">Not eligible</Badge>}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{job.description}</p>
            {job.requirements && <p className="mt-2 text-sm text-slate-600"><strong>Requirements:</strong> {job.requirements}</p>}
            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>
                {job.minTenureMonths ? `Min. ${job.minTenureMonths} months tenure · ` : ''}
                {job.closingDate ? `Closes ${formatDate(job.closingDate)}` : 'Open until filled'}
              </span>
              {!job.hasApplied &&
                (job.eligible ? (
                  <Button size="sm" onClick={() => { setForm({ coverNote: '', resumeUrl: '' }); setErrors({}); setApplying(job); }}>
                    Apply
                  </Button>
                ) : (
                  <span className="text-amber-700">{job.reason}</span>
                ))}
            </div>
          </Card>
        ))}
      </div>
      <Modal
        open={Boolean(applying)}
        onClose={() => setApplying(null)}
        title={`Apply: ${applying?.title || ''}`}
        description="Your manager is not notified automatically; HR reviews internal applications."
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplying(null)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={apply}>
              Submit application
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea label="Why are you a good fit?" required rows={5} maxLength={2000} value={form.coverNote} error={errors.coverNote} onChange={(e) => setForm((f) => ({ ...f, coverNote: e.target.value }))} />
          <Input label="Resume link (optional)" placeholder="https://…" value={form.resumeUrl} error={errors.resumeUrl} onChange={(e) => setForm((f) => ({ ...f, resumeUrl: e.target.value }))} />
        </div>
      </Modal>
    </>
  );
}

function ApplicationsTab() {
  const { data, loading, refetch } = useFetch('/careers/applications');
  const [docUrls, setDocUrls] = useState({});

  const submitDoc = async (app, doc) => {
    try {
      const res = await api.patch(`/careers/applications/${app._id}/documents/${doc._id}`, { url: docUrls[doc._id] });
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && !data) return <PageLoader />;
  if (!data?.length) return <EmptyState icon={Briefcase} message="You haven't applied for any internal job yet." />;
  return (
    <div className="space-y-4">
      {data.map((app) => (
        <Card key={app._id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">{app.job?.title}</h3>
              <p className="text-xs text-slate-500">
                {app.refNo} · applied {formatDate(app.createdAt)}
              </p>
            </div>
            <Badge status={app.status}>{app.statusLabel}</Badge>
          </div>
          <div className="mt-3">
            <StatusTracker status={app.status} />
          </div>
          {app.interviews.length > 0 && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interviews</p>
              {app.interviews.map((i) => (
                <p key={i._id} className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-slate-400" /> {i.round} — {formatDateTime(i.scheduledAt)} ({titleCase(i.mode)}
                  {i.location ? `, ${i.location}` : ''})
                </p>
              ))}
            </div>
          )}
          {app.documents.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents requested</p>
              {app.documents.map((d) => (
                <div key={d._id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-[140px] font-medium">{d.name}</span>
                  <Badge status={d.status} />
                  {['requested', 'rejected'].includes(d.status) && (
                    <>
                      <input className="form-control h-8 max-w-xs" placeholder="Link to document" value={docUrls[d._id] || ''} onChange={(e) => setDocUrls((u) => ({ ...u, [d._id]: e.target.value }))} />
                      <Button size="xs" onClick={() => submitDoc(app, d)}>
                        Submit
                      </Button>
                    </>
                  )}
                  {d.note && <span className="text-xs text-slate-500">{d.note}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function PanelTab() {
  const { data, loading, refetch } = useFetch('/careers/interviews');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ result: 'passed', feedback: '' });

  const save = async () => {
    try {
      const res = await api.patch(`/careers/interviews/${editing.applicationId}/${editing.interview._id}`, form);
      toast.success(res.message);
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && !data) return <PageLoader />;
  if (!data?.length) return <EmptyState icon={CalendarClock} message="You are not on any interview panel." />;
  return (
    <div className="space-y-3">
      {data.map((row) => (
        <Card key={row.interview._id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                {row.candidate?.name} — {row.job?.title}
              </p>
              <p className="text-sm text-slate-600">
                {row.interview.round} · {formatDateTime(row.interview.scheduledAt)} · {titleCase(row.interview.mode)}
                {row.interview.location ? ` · ${row.interview.location}` : ''}
              </p>
              {row.resumeUrl && (
                <a href={row.resumeUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                  View resume
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge status={row.interview.result} />
              <Button size="sm" variant="secondary" onClick={() => { setForm({ result: row.interview.result === 'pending' ? 'passed' : row.interview.result, feedback: row.interview.feedback || '' }); setEditing(row); }}>
                Feedback
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Interview feedback"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select label="Result" placeholder={false} options={INTERVIEW_RESULTS} value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} />
          <Textarea label="Feedback" rows={4} value={form.feedback} onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}

export default function CareersPage() {
  const [tab, setTab] = useTabParam('jobs', ['jobs', 'applications', 'interviews']);
  return (
    <div>
      <PageHeader title="Internal Jobs" subtitle="Open internal vacancies, your applications and interview panels" />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'jobs', label: 'Open positions' },
          { value: 'applications', label: 'My applications' },
          { value: 'interviews', label: 'Interview panels' },
        ]}
      />
      {tab === 'jobs' && <JobsTab />}
      {tab === 'applications' && <ApplicationsTab />}
      {tab === 'interviews' && <PanelTab />}
    </div>
  );
}
