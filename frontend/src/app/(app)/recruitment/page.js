'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarPlus, FilePlus2, Plus, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { useTabParam } from '@/hooks/useTabParam';
import { APPLICATION_STATUS, EMPLOYMENT_TYPES, HR_ROLES, INTERVIEW_MODES, INTERVIEW_RESULTS, JOB_STATUS } from '@/lib/constants';
import { formatDate, formatDateTime, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Card, Checkbox, DataTable, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import StatusTracker from '@/components/recruitment/StatusTracker';

const candidateName = (a) => (a.applicant ? getFullName(a.applicant) : a.candidate?.name);
const candidateEmail = (a) => a.applicant?.email || a.candidate?.email;

function JobModal({ open, job, onClose, onSaved }) {
  const departments = useFetch(open ? '/departments' : null);
  const blank = { title: '', department: '', location: '', employmentType: 'full-time', description: '', requirements: '', openings: 1, isInternal: true, minTenureMonths: 0, blockOnFinalWarning: true, closingDate: '', status: 'open' };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset(job ? { ...blank, ...job, department: job.department?._id || '', closingDate: job.closingDate || '' } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, job]);
  const onSubmit = form.handleSubmit(async (data) => {
    const payload = { ...data, openings: Number(data.openings), minTenureMonths: Number(data.minTenureMonths) };
    ['_id', 'refNo', 'createdBy', 'createdAt', 'updatedAt', '__v', 'applications', 'designation'].forEach((k) => delete payload[k]);
    const res = job ? await api.put(`/recruitment/jobs/${job._id}`, payload) : await api.post('/recruitment/jobs', payload);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={job ? `Edit ${job.refNo}` : 'New job posting'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="job-form" loading={form.submitting}>
            Save job
          </Button>
        </>
      }
    >
      <form id="job-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Job title" required className="sm:col-span-2" {...form.register('title')} />
        <Select label="Department" options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))} {...form.register('department')} />
        <Input label="Location" {...form.register('location')} />
        <Select label="Employment type" placeholder={false} options={EMPLOYMENT_TYPES} {...form.register('employmentType')} />
        <Input label="Openings" type="number" min="1" {...form.register('openings')} />
        <Textarea label="Description" required className="sm:col-span-2" rows={4} {...form.register('description')} />
        <Textarea label="Requirements" className="sm:col-span-2" rows={2} {...form.register('requirements')} />
        <Input label="Closing date" type="date" {...form.register('closingDate')} />
        <Select label="Status" placeholder={false} options={JOB_STATUS} {...form.register('status')} />
        <Checkbox label="Publish as internal vacancy" description="Visible to employees under Internal Jobs" {...form.register('isInternal', { type: 'checkbox' })} />
        <Checkbox label="Block employees on a final warning" {...form.register('blockOnFinalWarning', { type: 'checkbox' })} />
        <Input label="Minimum tenure for internal applicants (months)" type="number" min="0" {...form.register('minTenureMonths')} />
      </form>
    </Modal>
  );
}

function CandidateModal({ open, jobs, onClose, onSaved }) {
  const blank = { job: '', candidate: { name: '', email: '', phone: '' }, resumeUrl: '', source: 'external', coverNote: '', hrNotes: '' };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/recruitment/applications', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add candidate"
      description="The candidate is emailed a reference number to track their status."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="cand-form" loading={form.submitting}>
            Add candidate
          </Button>
        </>
      }
    >
      <form id="cand-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select label="Job" required className="sm:col-span-2" options={jobs.map((j) => ({ value: j._id, label: `${j.refNo} · ${j.title}` }))} {...form.register('job')} />
        <Input label="Name" required {...form.register('candidate.name')} />
        <Input label="Email" type="email" required {...form.register('candidate.email')} />
        <Input label="Phone" {...form.register('candidate.phone')} />
        <Select label="Source" placeholder={false} options={['external', 'referral']} {...form.register('source')} />
        <Input label="Resume link" className="sm:col-span-2" {...form.register('resumeUrl')} />
        <Textarea label="HR notes" className="sm:col-span-2" rows={2} {...form.register('hrNotes')} />
      </form>
    </Modal>
  );
}

function ApplicationModal({ id, onClose, onChanged }) {
  const { data: app, setData, loading } = useFetch(id ? `/recruitment/applications/${id}` : null);
  const people = useFetch(id ? '/employees/directory' : null, { params: { limit: 200 } });
  const [statusForm, setStatusForm] = useState({ status: '', note: '' });
  const [interview, setInterview] = useState({ round: 'Round 1', scheduledAt: '', durationMinutes: 45, mode: 'video', location: '', interviewers: [] });
  const [docNames, setDocNames] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res.message);
      if (res.data) setData(res.data);
      onChanged();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!id) return null;
  return (
    <Modal open onClose={onClose} size="xl" title={app ? `${candidateName(app)} · ${app.job?.title}` : 'Application'} description={app ? `${app.refNo} · ${candidateEmail(app)} · ${titleCase(app.source)}` : ''}>
      {loading && !app && <p className="text-sm text-slate-500">Loading…</p>}
      {app && (
        <div className="space-y-6">
          <StatusTracker status={app.status} />
          {(app.coverNote || app.resumeUrl || app.hrNotes) && (
            <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
              {app.coverNote && <p>{app.coverNote}</p>}
              {app.resumeUrl && (
                <a className="text-brand-600 hover:underline" href={app.resumeUrl} target="_blank" rel="noreferrer">
                  Resume
                </a>
              )}
              {app.hrNotes && <p className="text-xs text-slate-500">HR notes: {app.hrNotes}</p>}
            </div>
          )}

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Move to stage</h4>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Select className="sm:w-56" placeholder="Select status" options={APPLICATION_STATUS} value={statusForm.status} onChange={(e) => setStatusForm((f) => ({ ...f, status: e.target.value }))} />
              <input className="form-control flex-1" placeholder="Note to the applicant (optional)" value={statusForm.note} onChange={(e) => setStatusForm((f) => ({ ...f, note: e.target.value }))} />
              <Button loading={busy} disabled={!statusForm.status} onClick={() => run(() => api.patch(`/recruitment/applications/${app._id}/status`, statusForm)).then((ok) => ok && setStatusForm({ status: '', note: '' }))}>
                Update & notify
              </Button>
            </div>
            <ol className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              {app.statusHistory.map((h, i) => (
                <li key={i} className="rounded-full bg-slate-100 px-2 py-0.5">
                  {titleCase(h.status)} · {formatDate(h.at)}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Interviews</h4>
            {app.interviews.map((i) => (
              <div key={i._id} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {i.round} · {formatDateTime(i.scheduledAt)} · {titleCase(i.mode)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Panel: {i.interviewers.map(getFullName).join(', ')} {i.location ? `· ${i.location}` : ''}
                  </p>
                  {i.feedback && <p className="mt-1 text-xs italic text-slate-600">“{i.feedback}”</p>}
                </div>
                <Select
                  className="w-36"
                  placeholder={false}
                  options={INTERVIEW_RESULTS}
                  value={i.result}
                  onChange={(e) => run(() => api.patch(`/recruitment/applications/${app._id}/interviews/${i._id}`, { result: e.target.value, feedback: i.feedback || '' }))}
                />
              </div>
            ))}
            <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
              <Input label="Round" value={interview.round} onChange={(e) => setInterview((f) => ({ ...f, round: e.target.value }))} />
              <Input label="Date & time" type="datetime-local" value={interview.scheduledAt} onChange={(e) => setInterview((f) => ({ ...f, scheduledAt: e.target.value }))} />
              <Select label="Mode" placeholder={false} options={INTERVIEW_MODES} value={interview.mode} onChange={(e) => setInterview((f) => ({ ...f, mode: e.target.value }))} />
              <Input label="Room / meeting link" className="sm:col-span-2" value={interview.location} onChange={(e) => setInterview((f) => ({ ...f, location: e.target.value }))} />
              <Select
                label="Add interviewer"
                options={(people.data || []).filter((p) => !interview.interviewers.includes(p._id)).map((p) => ({ value: p._id, label: getFullName(p) }))}
                value=""
                onChange={(e) => e.target.value && setInterview((f) => ({ ...f, interviewers: [...f.interviewers, e.target.value] }))}
              />
              <div className="flex flex-wrap gap-1 sm:col-span-2">
                {interview.interviewers.map((pid) => (
                  <button key={pid} type="button" className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700" onClick={() => setInterview((f) => ({ ...f, interviewers: f.interviewers.filter((x) => x !== pid) }))}>
                    {getFullName((people.data || []).find((p) => p._id === pid))} ✕
                  </button>
                ))}
              </div>
              <div className="flex items-end justify-end">
                <Button
                  icon={CalendarPlus}
                  loading={busy}
                  onClick={() =>
                    run(() => api.post(`/recruitment/applications/${app._id}/interviews`, { ...interview, scheduledAt: interview.scheduledAt ? new Date(interview.scheduledAt).toISOString() : '' })).then(
                      (ok) => ok && setInterview((f) => ({ ...f, scheduledAt: '', interviewers: [] }))
                    )
                  }
                >
                  Schedule & invite
                </Button>
              </div>
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-slate-800">Documents</h4>
            {app.documents.map((d) => (
              <div key={d._id} className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-[160px] font-medium">{d.name}</span>
                <Badge status={d.status} />
                {d.url && (
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
                    Open
                  </a>
                )}
                {d.status === 'submitted' && (
                  <>
                    <Button size="xs" variant="success-soft" onClick={() => run(() => api.patch(`/recruitment/applications/${app._id}/documents/${d._id}`, { status: 'verified' }))}>
                      Verify
                    </Button>
                    <Button size="xs" variant="danger-soft" onClick={() => run(() => api.patch(`/recruitment/applications/${app._id}/documents/${d._id}`, { status: 'rejected', note: 'Please upload a clearer copy' }))}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <input className="form-control" placeholder="e.g. PAN card, Aadhaar, Last 3 payslips" value={docNames} onChange={(e) => setDocNames(e.target.value)} />
              <Button
                icon={FilePlus2}
                variant="secondary"
                loading={busy}
                onClick={() =>
                  run(() => api.post(`/recruitment/applications/${app._id}/documents`, { names: docNames.split(',').map((n) => n.trim()).filter(Boolean) })).then((ok) => ok && setDocNames(''))
                }
              >
                Request
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Separate several documents with commas. The applicant is notified and outstanding ones are tracked here.</p>
          </section>
        </div>
      )}
    </Modal>
  );
}

export default function RecruitmentPage() {
  const [tab, setTab] = useTabParam('pipeline', ['pipeline', 'jobs']);
  const [filters, setFilters] = useState({ job: '', status: '', search: '' });
  const [jobModal, setJobModal] = useState(undefined);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [openApp, setOpenApp] = useState(null);
  const jobs = useFetch('/recruitment/jobs');
  const apps = useFetch(tab === 'pipeline' ? '/recruitment/applications' : null, { params: { job: filters.job || undefined, status: filters.status || undefined, search: filters.search || undefined } });

  const appColumns = [
    { key: 'ref', header: 'Ref', render: (a) => <strong>{a.refNo}</strong> },
    { key: 'candidate', header: 'Candidate', render: (a) => (<div><p className="font-medium">{candidateName(a)}</p><p className="text-xs text-slate-500">{candidateEmail(a)}</p></div>) },
    { key: 'job', header: 'Job', render: (a) => a.job?.title },
    { key: 'source', header: 'Source', render: (a) => <Badge color={a.source === 'internal' ? 'purple' : 'gray'}>{titleCase(a.source)}</Badge> },
    { key: 'status', header: 'Status', render: (a) => <Badge status={a.status} /> },
    { key: 'interviews', header: 'Interviews', render: (a) => a.interviews.length || '—' },
    { key: 'docs', header: 'Docs pending', render: (a) => a.documents.filter((d) => d.status === 'requested').length || '—' },
    { key: 'applied', header: 'Applied', render: (a) => formatDate(a.createdAt) },
  ];
  const jobColumns = [
    { key: 'ref', header: 'Ref', render: (j) => <strong>{j.refNo}</strong> },
    { key: 'title', header: 'Title', render: (j) => j.title },
    { key: 'dept', header: 'Department', render: (j) => j.department?.name || '—' },
    { key: 'internal', header: 'Internal', render: (j) => (j.isInternal ? 'Yes' : 'No') },
    { key: 'openings', header: 'Openings', render: (j) => j.openings },
    { key: 'apps', header: 'Applications', render: (j) => j.applications.total },
    { key: 'closing', header: 'Closes', render: (j) => (j.closingDate ? formatDate(j.closingDate) : '—') },
    { key: 'status', header: 'Status', render: (j) => <Badge status={j.status} /> },
    { key: 'edit', header: '', render: (j) => <Button size="xs" variant="secondary" onClick={() => setJobModal(j)}>Edit</Button> },
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Recruitment (ATS)"
        subtitle="Application → screening → interview → selection → offer → onboarding"
        actions={
          <>
            <Button variant="secondary" icon={UserPlus} onClick={() => setCandidateOpen(true)}>
              Add candidate
            </Button>
            <Button icon={Plus} onClick={() => setJobModal(null)}>
              New job
            </Button>
          </>
        }
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pipeline', label: 'Applications' },
          { value: 'jobs', label: 'Job postings', count: jobs.data?.length },
        ]}
      />
      {tab === 'pipeline' ? (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="w-64" placeholder="Search name, email or ref" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
            <Select className="w-64" placeholder="All jobs" options={(jobs.data || []).map((j) => ({ value: j._id, label: j.title }))} value={filters.job} onChange={(e) => setFilters((f) => ({ ...f, job: e.target.value }))} />
            <Select className="w-52" placeholder="All statuses" options={APPLICATION_STATUS} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} />
          </div>
          <Card noPadding>
            <DataTable columns={appColumns} rows={apps.data} loading={apps.loading} onRowClick={(a) => setOpenApp(a._id)} emptyMessage="No applications" />
          </Card>
        </>
      ) : (
        <Card noPadding>
          <DataTable columns={jobColumns} rows={jobs.data} loading={jobs.loading} emptyMessage="No job postings yet" />
        </Card>
      )}

      <JobModal open={jobModal !== undefined} job={jobModal} onClose={() => setJobModal(undefined)} onSaved={jobs.refetch} />
      <CandidateModal open={candidateOpen} jobs={jobs.data || []} onClose={() => setCandidateOpen(false)} onSaved={apps.refetch} />
      <ApplicationModal id={openApp} onClose={() => setOpenApp(null)} onChanged={apps.refetch} />
    </RoleGuard>
  );
}
