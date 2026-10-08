'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LogOut, Pencil, UserMinus, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { getFullName } from '@/lib/format';
import { Badge, Button, Input, Modal, useConfirm } from '@/components/ui';
import PeoplePicker from './PeoplePicker';
import { PresenceAvatar } from './PresenceAvatar';
import { PRESENCE_LABEL, presenceOf, sameId } from './chatUtils';
import { useChat } from '@/context/ChatContext';

// Members of a group; everyone can add people and leave, admins can also rename it and remove people
export default function GroupInfoModal({ open, onClose, conversation, meId, onLeft }) {
  const chat = useChat();
  const confirm = useConfirm();
  const [mode, setMode] = useState('members'); // members | add | rename
  const [adding, setAdding] = useState([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('members');
    setAdding([]);
    setName(conversation?.name || '');
  }, [open, conversation?.name]);

  if (!conversation) return null;
  const isAdmin = conversation.admins.some((id) => sameId(id, meId));
  const isGroupAdmin = (member) => conversation.admins.some((id) => sameId(id, member));

  const run = async (request) => {
    setBusy(true);
    try {
      const res = await request();
      toast.success(res.message);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addPeople = async () => {
    if (await run(() => api.post(`/chat/conversations/${conversation._id}/members`, { userIds: adding.map((p) => p._id) }))) setMode('members');
  };

  const rename = async () => {
    if (await run(() => api.patch(`/chat/conversations/${conversation._id}`, { name }))) setMode('members');
  };

  const remove = async (member) => {
    const ok = await confirm({ title: `Remove ${getFullName(member)}?`, message: 'They will no longer see this group or its messages.', confirmText: 'Remove', danger: true });
    if (ok) await run(() => api.delete(`/chat/conversations/${conversation._id}/members/${member._id}`));
  };

  const leave = async () => {
    const ok = await confirm({ title: 'Leave group?', message: `You will no longer see "${conversation.name}" or its messages.`, confirmText: 'Leave', danger: true });
    if (ok && (await run(() => api.delete(`/chat/conversations/${conversation._id}/members/${meId}`)))) {
      onClose();
      onLeft(conversation._id);
    }
  };

  const footer =
    mode === 'members' ? (
      <Button variant="danger-soft" icon={LogOut} onClick={leave} loading={busy}>
        Leave group
      </Button>
    ) : (
      <>
        <Button variant="secondary" onClick={() => setMode('members')}>
          Back
        </Button>
        {mode === 'add' ? (
          <Button onClick={addPeople} loading={busy} disabled={!adding.length}>
            Add {adding.length || ''}
          </Button>
        ) : (
          <Button onClick={rename} loading={busy} disabled={!name.trim()}>
            Save name
          </Button>
        )}
      </>
    );

  return (
    <Modal open={open} onClose={onClose} title={conversation.name} description={`${conversation.members.length} members`} footer={footer}>
      {mode === 'add' && <PeoplePicker selected={adding} onChange={setAdding} excludeIds={conversation.members.map((m) => m._id)} />}

      {mode === 'rename' && <Input label="Group name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}

      {mode === 'members' && (
        <>
          <div className="mb-3 flex gap-2">
            <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setMode('add')}>
              Add people
            </Button>
            {isAdmin && (
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setMode('rename')}>
                Rename
              </Button>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {conversation.members.map((member) => (
              <li key={member._id} className="flex items-center gap-3 py-2.5">
                <PresenceAvatar user={member} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {getFullName(member)} {sameId(member, meId) && <span className="text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {member.designation?.title || member.email} · {PRESENCE_LABEL[presenceOf(member._id, chat)]}
                  </p>
                </div>
                {isGroupAdmin(member) && <Badge color="purple" dot={false}>Admin</Badge>}
                {isAdmin && !sameId(member, meId) && (
                  <Button size="sm" variant="ghost" icon={UserMinus} label={`Remove ${getFullName(member)}`} onClick={() => remove(member)} />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
