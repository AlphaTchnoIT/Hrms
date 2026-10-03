'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Briefcase, CalendarClock, Search } from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatDateTime, titleCase } from '@/lib/format';
import { Badge, Button, Input } from '@/components/ui';
import StatusTracker from '@/components/recruitment/StatusTracker';

/*
 * Public page (no login): external candidates check their application status
 * with the reference number and email from their confirmation email.
 */
export default function ApplicationStatusPage() {
  const [ref, setRef] = useState('');
  const [email, setEmail] = useState('');
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState({});

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('ref');
    if (fromUrl) setRef(fromUrl);
  }, []);

  const lookup = async (e) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await api.get('/public/application-status', { params: { ref, email } });
      setApp(res.data);
    } catch (err) {
      setApp(null);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitDoc = async (doc) => {
    try {
      const res = await api.post(`/public/applications/${app.refNo}/documents/${doc._id}`, { email, url: urls[doc._id] });
      toast.success(res.message);
      setApp(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white">
            <Briefcase className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="font-bold text-slate-900">PeopleHub Careers</p>
            <p className="text-xs text-slate-500">Track your application</p>
          </div>
        </div>

        <form onSubmit={lookup} className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input label="Reference number" placeholder="APP0001" value={ref} onChange={(e) => setRef(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" icon={Search} loading={loading} disabled={!ref || !email}>
            Check
          </Button>
        </form>

        {app && (
          <div className="card mt-6 space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{app.job?.title}</h2>
                <p className="text-xs text-slate-500">
                  {app.refNo} · applied {formatDate(app.createdAt)}
                </p>
              </div>
              <Badge status={app.status}>{app.statusLabel}</Badge>
            </div>
            <StatusTracker status={app.status} />
            {app.interviews.length > 0 && (
              <div className="space-y-1 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interviews</p>
                {app.interviews.map((i) => (
                  <p key={i._id} className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-slate-400" />
                    {i.round} — {formatDateTime(i.scheduledAt)} ({titleCase(i.mode)}
                    {i.location ? `, ${i.location}` : ''})
                  </p>
                ))}
              </div>
            )}
            {app.documents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents</p>
                {app.documents.map((d) => (
                  <div key={d._id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-[140px] font-medium">{d.name}</span>
                    <Badge status={d.status} />
                    {['requested', 'rejected'].includes(d.status) && (
                      <>
                        <input className="form-control h-8 max-w-xs" placeholder="Link to document" value={urls[d._id] || ''} onChange={(e) => setUrls((u) => ({ ...u, [d._id]: e.target.value }))} />
                        <Button size="xs" onClick={() => submitDoc(d)}>
                          Submit
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-slate-500">
          Employee?{' '}
          <Link href="/login" className="font-medium text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
