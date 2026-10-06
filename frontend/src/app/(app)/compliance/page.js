'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { CheckCircle2, CircleDashed, CircleSlash, ExternalLink, Pencil, Plus, ShieldCheck, Timer, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { HR_ROLES } from '@/lib/constants';
import { formatDate, toInputDate } from '@/lib/format';
import { Button, Card, ErrorMessage, Input, Modal, PageHeader, PageLoader, Select, Textarea, useConfirm } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';

const STATUS = {
  'to-do': { label: 'To do', icon: CircleDashed, className: 'text-slate-500 bg-slate-100' },
  'in-progress': { label: 'In progress', icon: Timer, className: 'text-amber-700 bg-amber-50' },
  done: { label: 'Done', icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-50' },
  'not-applicable': { label: 'Not applicable', icon: CircleSlash, className: 'text-slate-500 bg-slate-50' },
};
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }));

function ItemModal({ item, onClose, onSaved }) {
  const isNew = !item?._id;
  const [form, setForm] = useState(() => ({
    category: item?.category || 'Company specific',
    title: item?.title || '',
    description: item?.description || '',
    status: item?.status || 'to-do',
    owner: item?.owner || '',
    reviewedBy: item?.reviewedBy || '',
    reviewedOn: item?.reviewedOn || '',
    nextReviewOn: item?.nextReviewOn || '',
    documentUrl: item?.documentUrl || '',
    notes: item?.notes || '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const res = isNew ? await api.post('/compliance', form) : await api.put(`/compliance/${item._id}`, form);
      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isNew ? 'Add checklist item' : item.title}
      description={isNew ? 'Something your adviser asked you to put in place' : item.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {(isNew || !item.key) && (
          <>
            <Input label="Title" required className="sm:col-span-2" value={form.title} error={errors.title} onChange={set('title')} />
            <Input label="Category" value={form.category} error={errors.category} onChange={set('category')} />
            <Textarea label="What needs to be in place" rows={2} className="sm:col-span-2" value={form.description} onChange={set('description')} />
          </>
        )}
        <Select label="Status" placeholder={false} options={STATUS_OPTIONS} value={form.status} onChange={set('status')} />
        <Input label="Owner" placeholder="e.g. HR Manager" value={form.owner} onChange={set('owner')} />
        <Input label="Reviewed by" placeholder="e.g. Smith & Co Solicitors" value={form.reviewedBy} onChange={set('reviewedBy')} />
        <Input label="Reviewed on" type="date" max={toInputDate()} value={form.reviewedOn} error={errors.reviewedOn} onChange={set('reviewedOn')} />
        <Input label="Next review" type="date" hint="Admins get a reminder on this date" value={form.nextReviewOn} error={errors.nextReviewOn} onChange={set('nextReviewOn')} />
        <Input label="Document link" type="url" placeholder="https://..." value={form.documentUrl} error={errors.documentUrl} onChange={set('documentUrl')} />
        <Textarea label="Notes / adviser's comments" rows={3} className="sm:col-span-2" value={form.notes} onChange={set('notes')} />
      </div>
    </Modal>
  );
}

/*
 * UK compliance checklist: what the company must have in place before and while using the HRMS,
 * with who reviewed it (employment lawyer / accountant), when, and the next review.
 */
export default function CompliancePage() {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useFetch('/compliance');
  const [editing, setEditing] = useState(undefined);
  const today = toInputDate();

  const groups = (data?.items || []).reduce((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  const remove = async (item) => {
    const ok = await confirm({ title: `Delete "${item.title}"?`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/compliance/${item._id}`);
      toast.success('Item deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Compliance checklist"
        subtitle="What a UK employer must have in place. Record who reviewed each item (lawyer, accountant) and when to review it again."
        actions={
          <Button icon={Plus} onClick={() => setEditing(null)}>
            Add item
          </Button>
        }
      />
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <ShieldCheck className={clsx('h-10 w-10', data.progress.percent === 100 ? 'text-emerald-500' : 'text-amber-500')} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {data.progress.done} of {data.progress.total} done ({data.progress.percent}%)
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={clsx('h-full rounded-full', data.progress.percent === 100 ? 'bg-emerald-500' : 'bg-amber-400')} style={{ width: `${data.progress.percent}%` }} />
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            {Object.entries(groups).map(([category, items]) => (
              <Card key={category} noPadding title={category}>
                <ul className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const status = STATUS[item.status];
                    const overdue = item.nextReviewOn && item.nextReviewOn <= today && item.status !== 'not-applicable';
                    return (
                      <li key={item._id} className="flex flex-wrap items-start gap-3 px-5 py-4">
                        <span className={clsx('mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', status.className)}>
                          <status.icon className="h-3.5 w-3.5" /> {status.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-800">{item.title}</p>
                          {item.description && <p className="mt-0.5 text-sm text-slate-500">{item.description}</p>}
                          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            {item.owner && <span>Owner: {item.owner}</span>}
                            {item.reviewedBy && (
                              <span>
                                Reviewed by {item.reviewedBy}
                                {item.reviewedOn ? ` on ${formatDate(item.reviewedOn)}` : ''}
                              </span>
                            )}
                            {item.nextReviewOn && <span className={clsx(overdue && 'font-semibold text-rose-600')}>Next review {formatDate(item.nextReviewOn)}</span>}
                            {item.documentUrl && (
                              <a href={item.documentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
                                Document <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            {item.settingsLink && (
                              <Link href={item.settingsLink} className="text-brand-600 hover:underline">
                                Open in app
                              </Link>
                            )}
                          </p>
                          {item.notes && <p className="mt-1.5 whitespace-pre-line rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{item.notes}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="xs" variant="ghost" icon={Pencil} label="Edit" onClick={() => setEditing(item)} />
                          {!item.key && <Button size="xs" variant="ghost" icon={Trash2} label="Delete" onClick={() => remove(item)} />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ))}
          </div>
        </>
      )}
      {editing !== undefined && <ItemModal item={editing} onClose={() => setEditing(undefined)} onSaved={refetch} />}
    </RoleGuard>
  );
}
