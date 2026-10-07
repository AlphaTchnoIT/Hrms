'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { MessageSquare, MessageSquareOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useQueryValue } from '@/hooks/useTabParam';
import { Button, EmptyState } from '@/components/ui';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import NewChatModal from '@/components/chat/NewChatModal';
import GroupInfoModal from '@/components/chat/GroupInfoModal';
import { byLatest, messagePreview, sameId } from '@/components/chat/chatUtils';
import { openApp } from '@/lib/apps';

export default function ChatPage() {
  const { user, features } = useAuth();
  const { on, connected } = useChat();
  const meId = user._id;
  const linkedId = useQueryValue('c'); // /chat?c=<id> from a message toast

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const activeRef = useRef(null);
  activeRef.current = activeId;
  const listRef = useRef(conversations);
  listRef.current = conversations;
  const wasConnected = useRef(false);

  const upsert = useCallback((conversation) => {
    setConversations((previous) => [conversation, ...previous.filter((c) => c._id !== conversation._id)].sort(byLatest));
  }, []);

  const refreshOne = useCallback(
    (id) =>
      api
        .get(`/chat/conversations/${id}`)
        .then((res) => upsert(res.data))
        .catch(() => {}),
    [upsert]
  );

  const onMutedChange = useCallback((id, muted) => setConversations((previous) => previous.map((c) => (c._id === id ? { ...c, muted } : c))), []);

  const loadAll = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (features.chat) loadAll();
  }, [features.chat, loadAll]);

  // Back online after a drop: reload in case messages arrived meanwhile
  useEffect(() => {
    if (connected && wasConnected.current === 'lost') loadAll();
    if (connected) wasConnected.current = true;
    else if (wasConnected.current) wasConnected.current = 'lost';
  }, [connected, loadAll]);

  useEffect(() => {
    if (linkedId) setActiveId(linkedId);
  }, [linkedId]);

  // Keep the list in step with live events
  useEffect(() => {
    const offs = [
      on('conversation:updated', upsert),
      on('conversation:muted', ({ conversationId, muted }) => onMutedChange(conversationId, muted)),
      // A notification for another chat was clicked
      on('ui:open', setActiveId),
      on('conversation:removed', ({ conversationId }) => {
        setConversations((previous) => previous.filter((c) => c._id !== conversationId));
        if (activeRef.current === conversationId) setActiveId(null);
      }),
      on('message:new', ({ conversationId, message }) => {
        // Someone started a chat with me: fetch it once
        if (!listRef.current.some((c) => c._id === conversationId)) {
          refreshOne(conversationId);
          return;
        }
        setConversations((previous) => {
          const current = previous.find((c) => c._id === conversationId);
          if (!current) return previous;
          const counts = message.type !== 'system' && !sameId(message.sender, meId) && activeRef.current !== conversationId;
          const updated = {
            ...current,
            lastMessage: { text: messagePreview(message), sender: message.sender?._id || null, at: message.createdAt },
            lastMessageAt: message.createdAt,
            unread: counts ? current.unread + 1 : current.unread,
          };
          return [updated, ...previous.filter((c) => c._id !== conversationId)];
        });
      }),
      on('message:deleted', ({ conversationId }) => refreshOne(conversationId)),
      // An edit of the latest message changes the preview in the list
      on('message:updated', ({ conversationId, message }) =>
        setConversations((previous) =>
          previous.map((c) =>
            c._id === conversationId && c.lastMessage?.at && new Date(c.lastMessage.at).getTime() === new Date(message.createdAt).getTime()
              ? { ...c, lastMessage: { ...c.lastMessage, text: messagePreview(message) } }
              : c
          )
        )
      ),
      on('conversation:read', ({ conversationId, userId, at }) =>
        setConversations((previous) =>
          previous.map((c) =>
            c._id !== conversationId
              ? c
              : {
                  ...c,
                  unread: userId === meId ? 0 : c.unread,
                  members: c.members.map((m) => (sameId(m, userId) ? { ...m, lastReadAt: at } : m)),
                }
          )
        )
      ),
    ];
    return () => offs.forEach((off) => off());
  }, [on, upsert, refreshOne, meId, onMutedChange]);

  const onRead = useCallback((id) => setConversations((previous) => previous.map((c) => (c._id === id ? { ...c, unread: 0 } : c))), []);

  const onOpened = (conversation) => {
    upsert(conversation);
    setActiveId(conversation._id);
  };

  const onLeft = (id) => {
    setConversations((previous) => previous.filter((c) => c._id !== id));
    setActiveId(null);
  };

  if (!features.chat) {
    return (
      <div className="flex h-full items-center justify-center bg-white sm:rounded-2xl">
        <EmptyState
          icon={MessageSquareOff}
          title="Chat is switched off"
          message="An admin can switch it on in HRMS → Settings → Modules."
          action={<Button onClick={() => openApp('hrms')}>Open HRMS</Button>}
        />
      </div>
    );
  }

  const active = conversations.find((c) => c._id === activeId);

  return (
    <>
      <div className="flex h-full overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-card">
        <aside className={clsx('w-full shrink-0 border-r border-slate-100 md:block md:w-80', active ? 'hidden' : 'block')}>
          <ConversationList
            conversations={conversations}
            loading={loading}
            activeId={activeId}
            meId={meId}
            onSelect={setActiveId}
            onNewChat={() => setNewChatOpen(true)}
          />
        </aside>
        <section className={clsx('min-w-0 flex-1', active ? 'flex' : 'hidden md:flex')}>
          {active ? (
            <ChatWindow
              key={active._id}
              conversation={active}
              meId={meId}
              onBack={() => setActiveId(null)}
              onOpenInfo={() => setInfoOpen(true)}
              onRead={onRead}
              onMutedChange={onMutedChange}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Your chats"
                message="Pick a chat on the left, or start a new one with a colleague or a group."
                action={<Button onClick={() => setNewChatOpen(true)}>New chat</Button>}
              />
            </div>
          )}
        </section>
      </div>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} onOpened={onOpened} meId={meId} />
      <GroupInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} conversation={active?.type === 'group' ? active : null} meId={meId} onLeft={onLeft} />
    </>
  );
}
