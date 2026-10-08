'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getFullName } from '@/lib/format';
import { Avatar, Button, Modal, Spinner } from '@/components/ui';
import PeoplePicker from './PeoplePicker';
import { sameId } from './chatUtils';

/*
 * "Add people" from the call window.
 * Group call: ring group members who are not in the call, or add new people (they are added to the group,
 * then rung; any member can). 1-to-1 call: picking people turns it into a new group call.
 * onInvite(userIds) rings them (see CallContext).
 */
export default function AddToCallModal({ open, onClose, conversationId, isGroup, inCallIds, meId, onInvite }) {
  const [group, setGroup] = useState(null); // { members, admins } of the group chat
  const [loading, setLoading] = useState(false);
  const [ring, setRing] = useState([]); // group members to ring again
  const [adding, setAdding] = useState([]); // new people
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setRing([]);
    setAdding([]);
    setGroup(null);
    if (!isGroup) return undefined;
    let cancelled = false;
    setLoading(true);
    api
      .get(`/chat/conversations/${conversationId}`)
      .then((res) => !cancelled && setGroup(res.data))
      .catch(() => !cancelled && toast.error('Could not load the group'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, isGroup, conversationId]);

  const inCall = new Set(inCallIds.map(String));
  const notInCall = (group?.members || []).filter((m) => !sameId(m, meId) && !inCall.has(String(m._id)) && m.status === 'active');
  const excludeIds = isGroup ? (group?.members || []).map((m) => m._id) : [...inCallIds, meId];
  const total = ring.length + adding.length;

  const toggleRing = (id) => setRing((previous) => (previous.includes(id) ? previous.filter((x) => x !== id) : [...previous, id]));

  const submit = async () => {
    if (!total) return;
    setSaving(true);
    try {
      const newIds = adding.map((p) => String(p._id));
      if (isGroup && newIds.length) await api.post(`/chat/conversations/${conversationId}/members`, { userIds: newIds });
      await onInvite([...ring, ...newIds]);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Could not add them');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add people to the call"
      description={isGroup ? undefined : 'A new group chat is made with everyone, and this call carries on in it.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!total}>
            {total ? `Ring ${total} ${total === 1 ? 'person' : 'people'}` : 'Ring'}
          </Button>
        </>
      }
    >
      {loading && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}

      {isGroup && !loading && notInCall.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">In this group, not in the call</p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {notInCall.map((member) => {
              const id = String(member._id);
              const picked = ring.includes(id);
              return (
                <li key={id}>
                  <button
                    onClick={() => toggleRing(id)}
                    aria-pressed={picked}
                    className={clsx('flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm', picked ? 'bg-brand-50' : 'hover:bg-slate-50')}
                  >
                    <Avatar name={getFullName(member)} src={member.avatar} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{getFullName(member)}</span>
                    <span className={clsx('flex h-5 w-5 items-center justify-center rounded-md border', picked ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300')}>
                      {picked && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!loading && (
        <div>
          {isGroup && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Someone new (added to the group too)</p>}
          <PeoplePicker selected={adding} onChange={setAdding} excludeIds={excludeIds} autoFocus={!isGroup || !notInCall.length} />
        </div>
      )}
    </Modal>
  );
}
