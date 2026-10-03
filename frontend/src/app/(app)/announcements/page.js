'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { announcementSchema } from '@/lib/validation';
import { ANNOUNCEMENT_CATEGORIES } from '@/lib/constants';
import { formatDate, getFullName, toInputDate } from '@/lib/format';
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Input, Modal, PageHeader, Pagination, Select, Skeleton, Textarea, useConfirm } from '@/components/ui';

const CATEGORY_COLORS = { general: 'gray', policy: 'blue', event: 'purple', celebration: 'green', urgent: 'red' };

function AnnouncementModal({ item, onClose, onSaved }) {
  const form = useForm(
    {
      title: item?.title || '',
      content: item?.content || '',
      category: item?.category || 'general',
      isPinned: item?.isPinned || false,
      expiresAt: item?.expiresAt ? toInputDate(item.expiresAt) : '',
    },
    { schema: announcementSchema }
  );

  const onSubmit = form.handleSubmit(async (data) => {
    const res = item ? await api.put(`/announcements/${item._id}`, data) : await api.post('/announcements', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={item ? 'Edit announcement' : 'New announcement'}
      description="Visible to everyone in the company."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="announcement-form" loading={form.submitting}>
            {item ? 'Save changes' : 'Publish'}
          </Button>
        </>
      }
    >
      <form id="announcement-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Input label="Title" required {...form.register('title')} />
        <Textarea label="Message" rows={6} required maxLength={5000} {...form.register('content')} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Category" required placeholder={false} options={ANNOUNCEMENT_CATEGORIES} {...form.register('category')} />
          <Input label="Expires on" type="date" min={toInputDate()} hint="Optional" {...form.register('expiresAt')} />
        </div>
        <Checkbox label="Pin to top" description="Pinned posts stay above the others" {...form.register('isPinned', { type: 'checkbox' })} />
      </form>
    </Modal>
  );
}

export default function AnnouncementsPage() {
  const { isHR } = useAuth();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const { data, meta, loading, refetch } = useFetch('/announcements', {
    params: { page, limit: 10, includeExpired: isHR ? 'true' : undefined },
  });

  const remove = async (item) => {
    const ok = await confirm({ title: 'Delete announcement?', message: `"${item.title}" will be removed for everyone.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/announcements/${item._id}`);
      toast.success('Announcement deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Announcements"
        subtitle="Company news and updates"
        actions={
          isHR && (
            <Button icon={Plus} onClick={() => setEditing(null)}>
              New announcement
            </Button>
          )
        }
      />

      {loading && !data && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      )}
      {!loading && !data?.length && (
        <Card>
          <EmptyState icon={Megaphone} title="No announcements" message="Company news will show up here." />
        </Card>
      )}

      <div className="space-y-4">
        {(data || []).map((a) => {
          const expired = a.expiresAt && new Date(a.expiresAt) < new Date();
          return (
            <article key={a._id} className={`card p-6 ${a.isPinned ? 'border-brand-200' : ''} ${expired ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={getFullName(a.createdBy)} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{getFullName(a.createdBy)}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(a.createdAt)}
                      {a.expiresAt && ` · ${expired ? 'expired' : 'expires'} ${formatDate(a.expiresAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {a.isPinned && (
                    <Badge color="purple" dot={false}>
                      <Pin className="h-3 w-3" /> Pinned
                    </Badge>
                  )}
                  <Badge color={CATEGORY_COLORS[a.category]}>{a.category}</Badge>
                  {isHR && (
                    <>
                      <Button size="sm" variant="ghost" icon={Pencil} label="Edit" onClick={() => setEditing(a)} />
                      <Button size="sm" variant="ghost" icon={Trash2} label="Delete" onClick={() => remove(a)} />
                    </>
                  )}
                </div>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-slate-900">{a.title}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{a.content}</p>
            </article>
          );
        })}
      </div>

      {meta?.totalPages > 1 && (
        <div className="card mt-4">
          <Pagination meta={meta} onPageChange={setPage} />
        </div>
      )}

      {editing !== undefined && <AnnouncementModal item={editing} onClose={() => setEditing(undefined)} onSaved={refetch} />}
    </div>
  );
}
