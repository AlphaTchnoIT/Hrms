'use client';

import { CheckCheck, Clock } from 'lucide-react';
import { formatDateTime, getFullName } from '@/lib/format';
import { Avatar, Modal } from '@/components/ui';
import { sameId } from './chatUtils';

// Who has read a message (from each member's "read up to" time) and who hasn't yet
export default function SeenByModal({ message, members, meId, onClose }) {
  if (!message) return null;
  const sentAt = new Date(message.createdAt);
  const others = members.filter((m) => !sameId(m, meId) && !sameId(m, message.sender));
  const seen = others.filter((m) => m.lastReadAt && new Date(m.lastReadAt) >= sentAt).sort((a, b) => new Date(a.lastReadAt) - new Date(b.lastReadAt));
  const notYet = others.filter((m) => !seen.includes(m));

  const Row = ({ member, detail }) => (
    <li className="flex items-center gap-3 py-2">
      <Avatar name={getFullName(member)} src={member.avatar} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{getFullName(member)}</p>
        <p className="truncate text-xs text-slate-500">{detail}</p>
      </div>
    </li>
  );

  return (
    <Modal open onClose={onClose} title="Message info" description={`Sent ${formatDateTime(message.createdAt)}`} size="sm">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-600">
        <CheckCheck className="h-4 w-4" /> Seen by {seen.length}
      </p>
      {seen.length ? (
        <ul className="mb-4 divide-y divide-slate-100">
          {seen.map((m) => (
            // "read up to" can be later than the actual moment they saw it, so it is shown as "by"
            <Row key={m._id} member={m} detail={`Seen by ${formatDateTime(m.lastReadAt)}`} />
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-slate-500">Nobody has seen it yet.</p>
      )}

      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <Clock className="h-4 w-4" /> Not seen yet ({notYet.length})
      </p>
      {notYet.length ? (
        <ul className="divide-y divide-slate-100">
          {notYet.map((m) => (
            <Row key={m._id} member={m} detail={m.designation?.title || m.email || ''} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Everyone has seen it.</p>
      )}
    </Modal>
  );
}
