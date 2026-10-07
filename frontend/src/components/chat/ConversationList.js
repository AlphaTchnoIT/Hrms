'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { BellOff, BellRing, MessageSquarePlus, Search } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { useChat } from '@/context/ChatContext';
import { GroupAvatar, PresenceAvatar } from './PresenceAvatar';
import { conversationTitle, listTime, otherMember, sameId } from './chatUtils';

export default function ConversationList({ conversations, loading, activeId, meId, onSelect, onNewChat }) {
  const { notificationPermission, enableNotifications } = useChat();
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = term ? conversations.filter((c) => conversationTitle(c, meId).toLowerCase().includes(term)) : conversations;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">Chat</h2>
        <Button size="sm" icon={MessageSquarePlus} onClick={onNewChat}>
          New chat
        </Button>
      </div>
      {notificationPermission === 'default' && (
        <button
          onClick={enableNotifications}
          className="mx-3 mt-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-left text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          <BellRing className="h-4 w-4 shrink-0" /> Turn on desktop notifications for new messages
        </button>
      )}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" className="form-control h-9 pl-9 text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading &&
          [1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}

        {!loading && !shown.length && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {term ? 'No chats match your search' : 'No chats yet. Start one with "New chat".'}
          </p>
        )}

        {shown.map((conversation) => {
          const active = sameId(conversation, activeId);
          const unread = !active && conversation.unread > 0;
          const last = conversation.lastMessage;
          const fromMe = last?.sender && sameId(last.sender, meId);
          return (
            <button
              key={conversation._id}
              onClick={() => onSelect(conversation._id)}
              className={clsx('flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition', active ? 'bg-brand-50' : 'hover:bg-slate-50')}
            >
              {conversation.type === 'group' ? <GroupAvatar /> : <PresenceAvatar user={otherMember(conversation, meId)} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={clsx('truncate text-sm', unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800')}>
                    {conversationTitle(conversation, meId)}
                  </p>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                    {conversation.muted && <BellOff className="h-3 w-3" aria-label="Muted" />}
                    {listTime(last?.at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className={clsx('truncate text-xs', unread ? 'font-medium text-slate-700' : 'text-slate-500')}>
                    {last?.text ? `${fromMe ? 'You: ' : ''}${last.text}` : 'No messages yet'}
                  </p>
                  {unread && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                      {conversation.unread > 99 ? '99+' : conversation.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
