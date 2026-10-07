'use client';

import clsx from 'clsx';
import { Users } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { useChat } from '@/context/ChatContext';
import { getFullName } from '@/lib/format';
import { PRESENCE_DOT, PRESENCE_LABEL, presenceOf } from './chatUtils';

// Avatar with a green (online) / amber (on leave) / grey (offline) dot
export function PresenceAvatar({ user, size = 'md' }) {
  const chat = useChat();
  const status = presenceOf(user._id, chat);
  return (
    <div className="relative shrink-0">
      <Avatar name={getFullName(user)} src={user.avatar} size={size} />
      <span
        title={PRESENCE_LABEL[status]}
        className={clsx('absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white', PRESENCE_DOT[status])}
      />
    </div>
  );
}

export function GroupAvatar({ size = 'md' }) {
  return (
    <div className={clsx('flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700', size === 'sm' ? 'h-8 w-8' : 'h-10 w-10')}>
      <Users className="h-5 w-5" />
    </div>
  );
}
