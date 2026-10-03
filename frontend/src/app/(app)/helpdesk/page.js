'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Headphones, Lock, Plus, Send } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { useQueryValue } from '@/hooks/useTabParam';
import { TICKET_CATEGORIES, TICKET_PRIORITY, TICKET_STATUS } from '@/lib/constants';
import { formatDateTime, getFullName, titleCase } from '@/lib/format';
import { Badge, Button, Card, Checkbox, DataTable, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';

function NewTicketModal({ open, onClose, onSaved }) {
  const blank = { category: '', priority: 'medium', subject: '', description: '', assetTag: '' };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.post('/support/tickets', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Raise IT ticket"
      description="System issues, access requests, software updates, hardware and other technical concerns"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="ticket-form" loading={form.submitting}>
            Submit ticket
          </Button>
        </>
      }
    >
      <form id="ticket-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Select label="Category" required options={TICKET_CATEGORIES} {...form.register('category')} />
        <Select label="Priority" placeholder={false} options={TICKET_PRIORITY} {...form.register('priority')} />
        <Input label="Subject" required className="sm:col-span-2" {...form.register('subject')} />
        <Textarea label="Description" required className="sm:col-span-2" rows={4} maxLength={5000} {...form.register('description')} />
        <Input label="Asset tag (if hardware)" placeholder="AST0001" {...form.register('assetTag')} />
      </form>
    </Modal>
  );
}

function TicketModal({ id, onClose, onChanged }) {
  const { user, isIT } = useAuth();
  const { data: ticket, setData } = useFetch(id ? `/support/tickets/${id}` : null);
  const itPeople = useFetch(isIT ? '/employees/directory' : null, { params: { role: 'it', limit: 200 } });
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [update, setUpdate] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ticket) setUpdate({ status: ticket.status, priority: ticket.priority, assignedTo: ticket.assignedTo?._id || '', resolution: ticket.resolution || '' });
  }, [ticket]);

  const run = async (fn) => {
    setBusy(true);
    try {
      const res = await fn();
      toast.success(res.message);
      setData(res.data);
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
  const isOwner = ticket && ticket.raisedBy?._id === user?._id;
  const assignees = [...(itPeople.data || []), ...(user?.role === 'admin' ? [user] : [])];

  return (
    <Modal open onClose={onClose} size="xl" title={ticket ? `${ticket.ticketNo} · ${ticket.subject}` : 'Ticket'} description={ticket && `${titleCase(ticket.category)} · raised ${formatDateTime(ticket.createdAt)} by ${getFullName(ticket.raisedBy)}`}>
      {ticket && (
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0 space-y-4">
            <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{ticket.description}</p>
            <div className="space-y-3">
              {ticket.comments.map((c) => (
                <div key={c._id} className={clsx('rounded-lg p-3 text-sm', c.isInternal ? 'border border-dashed border-amber-300 bg-amber-50' : c.by?._id === ticket.raisedBy?._id ? 'bg-white ring-1 ring-slate-200' : 'bg-brand-50')}>
                  <p className="text-xs font-medium text-slate-500">
                    {getFullName(c.by)} · {formatDateTime(c.createdAt)} {c.isInternal && '· internal note'}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-slate-800">{c.message}</p>
                </div>
              ))}
            </div>
            {ticket.status !== 'closed' && (
              <div className="space-y-2">
                <Textarea rows={3} placeholder="Write a message…" value={message} onChange={(e) => setMessage(e.target.value)} />
                <div className="flex items-center justify-between">
                  {isIT ? <Checkbox label="Internal note (hidden from requester)" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> : <span />}
                  <Button icon={internal ? Lock : Send} loading={busy} disabled={!message.trim()} onClick={() => run(() => api.post(`/support/tickets/${id}/comments`, { message, isInternal: internal })).then((ok) => ok && setMessage(''))}>
                    Send
                  </Button>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge status={ticket.status} />
              <Badge status={ticket.priority}>{titleCase(ticket.priority)} priority</Badge>
            </div>
            {ticket.resolution && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">Resolution: {ticket.resolution}</p>}
            {isIT && update && (
              <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <Select label="Status" placeholder={false} options={TICKET_STATUS} value={update.status} onChange={(e) => setUpdate((u) => ({ ...u, status: e.target.value }))} />
                <Select label="Priority" placeholder={false} options={TICKET_PRIORITY} value={update.priority} onChange={(e) => setUpdate((u) => ({ ...u, priority: e.target.value }))} />
                <Select label="Assigned to" placeholder="Unassigned" options={assignees.map((p) => ({ value: p._id, label: getFullName(p) }))} value={update.assignedTo} onChange={(e) => setUpdate((u) => ({ ...u, assignedTo: e.target.value }))} />
                <Textarea label="Resolution" rows={2} value={update.resolution} onChange={(e) => setUpdate((u) => ({ ...u, resolution: e.target.value }))} />
                <Button className="w-full" loading={busy} onClick={() => run(() => api.patch(`/support/tickets/${id}`, update))}>
                  Update ticket
                </Button>
              </div>
            )}
            {isOwner && ['resolved'].includes(ticket.status) && (
              <div className="flex gap-2">
                <Button size="sm" variant="success" onClick={() => run(() => api.patch(`/support/tickets/${id}/close`, {}))}>
                  Confirm fixed
                </Button>
                <Button size="sm" variant="secondary" onClick={() => run(() => api.patch(`/support/tickets/${id}/close`, { reopen: true }))}>
                  Reopen
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function HelpdeskPage() {
  const { isIT } = useAuth();
  const ticketParam = useQueryValue('ticket');
  const [scope, setScope] = useState('mine');
  const [status, setStatus] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const { data, loading, refetch } = useFetch('/support/tickets', { params: { scope: isIT ? scope : 'mine', status: status || undefined } });

  useEffect(() => {
    if (ticketParam) setOpenId(ticketParam);
  }, [ticketParam]);
  useEffect(() => {
    if (isIT) setScope('all');
  }, [isIT]);

  const columns = [
    { key: 'no', header: 'Ticket', render: (t) => <strong>{t.ticketNo}</strong> },
    { key: 'subject', header: 'Subject', className: 'max-w-xs whitespace-normal', render: (t) => t.subject },
    ...(isIT && scope === 'all' ? [{ key: 'by', header: 'Raised by', render: (t) => <EmployeeCell employee={t.raisedBy} /> }] : []),
    { key: 'category', header: 'Category', render: (t) => titleCase(t.category) },
    { key: 'priority', header: 'Priority', render: (t) => <Badge status={t.priority} /> },
    { key: 'assigned', header: 'Assigned', render: (t) => (t.assignedTo ? getFullName(t.assignedTo) : '—') },
    { key: 'status', header: 'Status', render: (t) => <Badge status={t.status} /> },
    { key: 'updated', header: 'Updated', render: (t) => formatDateTime(t.updatedAt) },
  ];

  return (
    <div>
      <PageHeader
        title="IT Helpdesk"
        subtitle="Raise IT tickets, track their status and talk to the IT team"
        actions={
          <Button icon={Plus} onClick={() => setNewOpen(true)}>
            Raise ticket
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isIT && (
          <Tabs
            value={scope}
            onChange={setScope}
            tabs={[
              { value: 'all', label: 'All tickets' },
              { value: 'mine', label: 'Raised by me' },
            ]}
          />
        )}
        <Select className="w-48" placeholder="All statuses" options={TICKET_STATUS} value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>
      <Card noPadding>
        <DataTable columns={columns} rows={data} loading={loading} onRowClick={(t) => setOpenId(t._id)} emptyIcon={Headphones} emptyMessage="No tickets" />
      </Card>
      <NewTicketModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={refetch} />
      <TicketModal id={openId} onClose={() => setOpenId(null)} onChanged={refetch} />
    </div>
  );
}
