'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { MessageSquare, MessageSquareOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useChat } from '@/context/ChatContext';
import { useQueryValue } from '@/hooks/useTabParam';
import { Button, EmptyState, useConfirm } from '@/components/ui';
import FolderNameModal from '@/components/chat/FolderNameModal';
import SavedView from '@/components/chat/SavedView';
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
  const [folders, setFolders] = useState([]); // my own chat folders, in my order
  const [savedOpen, setSavedOpen] = useState(false); // "Saved messages" shown on the right
  const [focus, setFocus] = useState(null); // { messageId, at }: jump to this message in the open chat
  // { folder } to rename, { conversation } to move into the new folder, {} for a plain new folder
  const [folderModal, setFolderModal] = useState(null);
  const confirm = useConfirm();
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

  // My own settings for a chat changed (here or in another tab): { muted } / { pinned }
  const onPrefsChange = useCallback((id, prefs) => setConversations((previous) => previous.map((c) => (c._id === id ? { ...c, ...prefs } : c))), []);

  const togglePin = async (conversation) => {
    const pinned = !conversation.pinned;
    try {
      const res = await api.patch(`/chat/conversations/${conversation._id}/pin`, { pinned });
      onPrefsChange(conversation._id, { pinned });
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  /* ------------------------------- folders ------------------------------- */

  const moveToFolder = async (conversation, folderId) => {
    try {
      const res = await api.patch(`/chat/conversations/${conversation._id}/folder`, { folderId });
      onPrefsChange(conversation._id, { folder: folderId });
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Create (and optionally move a chat into it) or rename; errors are shown in the modal
  const saveFolder = async (name) => {
    if (folderModal?.folder) {
      await api.patch(`/chat/folders/${folderModal.folder._id}`, { name });
      setFolders((previous) => previous.map((f) => (f._id === folderModal.folder._id ? { ...f, name } : f)));
      toast.success('Folder renamed');
      return;
    }
    const res = await api.post('/chat/folders', { name });
    setFolders((previous) => (previous.some((f) => f._id === res.data._id) ? previous : [...previous, res.data]));
    toast.success(res.message);
    if (folderModal?.conversation) await moveToFolder(folderModal.conversation, res.data._id);
  };

  const deleteFolder = async (folder) => {
    const ok = await confirm({
      title: `Delete folder "${folder.name}"?`,
      message: 'Its chats go back to Chats. No chat or message is deleted.',
      confirmText: 'Delete folder',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/chat/folders/${folder._id}`);
      setFolders((previous) => previous.filter((f) => f._id !== folder._id));
      setConversations((previous) => previous.map((c) => (c.folder === folder._id ? { ...c, folder: null } : c)));
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Move a folder one place up (-1) or down (+1)
  const moveFolder = async (folder, step) => {
    const index = folders.findIndex((f) => f._id === folder._id);
    const target = index + step;
    if (index < 0 || target < 0 || target >= folders.length) return;
    const next = [...folders];
    [next[index], next[target]] = [next[target], next[index]];
    setFolders(next);
    try {
      await api.put('/chat/folders/order', { folderIds: next.map((f) => f._id) });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loadAll = useCallback(async () => {
    try {
      const [res, folderRes] = await Promise.all([api.get('/chat/conversations'), api.get('/chat/folders')]);
      setConversations(res.data);
      setFolders(folderRes.data);
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
      on('conversation:prefs', ({ conversationId, ...prefs }) => onPrefsChange(conversationId, prefs)),
      // Folders created / renamed / reordered / deleted in another tab or device
      on('chat:folders', ({ folders: list }) => setFolders(list)),
      // A notification for another chat was clicked
      on('ui:open', (conversationId) => {
        if (!listRef.current.some((c) => c._id === conversationId)) refreshOne(conversationId);
        setActiveId(conversationId);
      }),
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
          const important = counts && message.priority && message.priority !== 'standard';
          const mentioned = counts && (message.mentions || []).some((id) => sameId(id, meId));
          const updated = {
            ...current,
            lastMessage: { text: messagePreview(message), sender: message.sender?._id || null, at: message.createdAt },
            lastMessageAt: message.createdAt,
            unread: counts ? current.unread + 1 : current.unread,
            importantUnread: (current.importantUnread || 0) + (important ? 1 : 0),
            mentionUnread: (current.mentionUnread || 0) + (mentioned ? 1 : 0),
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
                  ...(userId === meId ? { unread: 0, importantUnread: 0, mentionUnread: 0 } : {}),
                  members: c.members.map((m) => (sameId(m, userId) ? { ...m, lastReadAt: at } : m)),
                }
          )
        )
      ),
    ];
    return () => offs.forEach((off) => off());
  }, [on, upsert, refreshOne, meId, onPrefsChange]);

  const onRead = useCallback(
    (id) => setConversations((previous) => previous.map((c) => (c._id === id ? { ...c, unread: 0, importantUnread: 0, mentionUnread: 0 } : c))),
    []
  );

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
  const showSaved = savedOpen && !active;
  const panelOpen = Boolean(active) || showSaved;

  const selectChat = (id) => {
    setSavedOpen(false);
    setFocus(null);
    setActiveId(id);
  };

  // From a search result or a saved message: open that chat scrolled to the message
  const openMessage = (conversationId, messageId) => {
    setSavedOpen(false);
    setActiveId(String(conversationId));
    setFocus({ conversationId: String(conversationId), messageId: String(messageId), at: Date.now() });
  };

  return (
    <>
      <div className="flex h-full overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-card">
        <aside className={clsx('w-full shrink-0 border-r border-slate-100 md:block md:w-80', panelOpen ? 'hidden' : 'block')}>
          <ConversationList
            conversations={conversations}
            loading={loading}
            activeId={activeId}
            meId={meId}
            onSelect={selectChat}
            onOpenMessage={openMessage}
            onOpenSaved={() => {
              setActiveId(null);
              setSavedOpen(true);
            }}
            savedActive={showSaved}
            onNewChat={() => setNewChatOpen(true)}
            onTogglePin={togglePin}
            folders={folders}
            onMoveToFolder={moveToFolder}
            onNewFolder={(conversation) => setFolderModal(conversation ? { conversation } : {})}
            onRenameFolder={(folder) => setFolderModal({ folder })}
            onDeleteFolder={deleteFolder}
            onMoveFolder={moveFolder}
          />
        </aside>
        <section className={clsx('min-w-0 flex-1', panelOpen ? 'flex' : 'hidden md:flex')}>
          {showSaved && <SavedView conversations={conversations} meId={meId} onOpenMessage={openMessage} onBack={() => setSavedOpen(false)} />}
          {active ? (
            <ChatWindow
              key={active._id}
              conversation={active}
              meId={meId}
              focus={focus?.conversationId === active._id ? focus : null}
              onBack={() => setActiveId(null)}
              onOpenInfo={() => setInfoOpen(true)}
              onRead={onRead}
              onPrefsChange={onPrefsChange}
              onTogglePin={() => togglePin(active)}
            />
          ) : (
            !showSaved && (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Your chats"
                message="Pick a chat on the left, or start a new one with a colleague or a group."
                action={<Button onClick={() => setNewChatOpen(true)}>New chat</Button>}
              />
            </div>
            )
          )}
        </section>
      </div>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} onOpened={onOpened} meId={meId} />
      <FolderNameModal open={Boolean(folderModal)} initialName={folderModal?.folder?.name || ''} onClose={() => setFolderModal(null)} onSave={saveFolder} />
      <GroupInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} conversation={active?.type === 'group' ? active : null} meId={meId} onLeft={onLeft} />
    </>
  );
}
