'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowDown,
  ArrowUp,
  AtSign,
  BellOff,
  BellRing,
  Bookmark,
  MessageSquareText,
  ChevronDown,
  CircleAlert,
  Folder,
  FolderInput,
  FolderMinus,
  FolderPlus,
  MessageSquarePlus,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
} from 'lucide-react';
import { Button, Skeleton } from '@/components/ui';
import { useChat } from '@/context/ChatContext';
import ChatMenu from './ChatMenu';
import { GroupAvatar, PresenceAvatar } from './PresenceAvatar';
import api from '@/lib/api';
import { getFullName } from '@/lib/format';
import { conversationTitle, listTime, messagePreview, otherMember, sameId, sectionOf } from './chatUtils';

// The search term in bold inside a result (plain text, never HTML)
function Highlight({ text = '', term }) {
  const index = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-100 px-0.5 font-semibold text-slate-800">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

function ConversationRow({ conversation, active, meId, folders, onSelect, onTogglePin, onMoveToFolder, onNewFolder }) {
  const unread = !active && conversation.unread > 0;
  const last = conversation.lastMessage;
  const fromMe = last?.sender && sameId(last.sender, meId);
  const title = conversationTitle(conversation, meId);

  const menu = [
    {
      label: conversation.pinned ? 'Remove from Favourites' : 'Add to Favourites',
      icon: conversation.pinned ? PinOff : Pin,
      onClick: () => onTogglePin(conversation),
    },
    { divider: true },
    { heading: 'Move to folder' },
    ...folders.map((folder) => ({
      label: folder.name,
      icon: Folder,
      checked: conversation.folder === folder._id,
      onClick: () => onMoveToFolder(conversation, conversation.folder === folder._id ? null : folder._id),
    })),
    { label: 'New folder…', icon: FolderPlus, onClick: () => onNewFolder(conversation) },
    ...(conversation.folder ? [{ label: 'Remove from folder', icon: FolderMinus, onClick: () => onMoveToFolder(conversation, null) }] : []),
  ];

  return (
    <div className="group/row relative">
      <button
        onClick={() => onSelect(conversation._id)}
        className={clsx('flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition', active ? 'bg-brand-50' : 'hover:bg-slate-50')}
      >
        {conversation.type === 'group' ? <GroupAvatar /> : <PresenceAvatar user={otherMember(conversation, meId)} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={clsx('truncate text-sm', unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800')}>{title}</p>
            {/* Hidden only while the ⋯ menu is showing in its place (hover, or keyboard focus on the menu) */}
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400 group-hover/row:invisible group-has-[[aria-haspopup]:focus-visible]/row:invisible">
              {conversation.pinned && <Pin className="h-3 w-3" aria-label="In Favourites" />}
              {conversation.muted && <BellOff className="h-3 w-3" aria-label="Muted" />}
              {listTime(last?.at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={clsx('truncate text-xs', unread ? 'font-medium text-slate-700' : 'text-slate-500')}>
              {last?.text ? `${fromMe ? 'You: ' : ''}${last.text}` : 'No messages yet'}
            </p>
            <span className="flex shrink-0 items-center gap-1">
              {!active && conversation.mentionUnread > 0 && (
                <span title="You were mentioned" className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <AtSign className="h-3 w-3" />
                </span>
              )}
              {!active && conversation.importantUnread > 0 && (
                <span title="Important message" className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <CircleAlert className="h-3 w-3" />
                </span>
              )}
              {unread && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">
                  {conversation.unread > 99 ? '99+' : conversation.unread}
                </span>
              )}
            </span>
          </div>
        </div>
      </button>
      {/* ⋯ menu (Favourites, folders), shown on hover or keyboard focus */}
      <ChatMenu
        items={menu}
        label={`Options for ${title}`}
        className="absolute right-1.5 top-1.5 opacity-0 focus-within:opacity-100 group-hover/row:opacity-100 [&:has([aria-expanded=true])]:opacity-100"
      />
    </div>
  );
}

export default function ConversationList({
  conversations,
  folders,
  loading,
  activeId,
  meId,
  onSelect,
  onNewChat,
  onTogglePin,
  onMoveToFolder,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onOpenMessage,
  onOpenSaved,
  savedActive,
}) {
  const { notificationPermission, enableNotifications } = useChat();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [messageHits, setMessageHits] = useState(null); // null = not searched, [] = no results
  const term = search.trim().toLowerCase();

  // Also search inside messages (2+ letters), a moment after typing stops
  useEffect(() => {
    if (term.length < 2) {
      setMessageHits(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/chat/search', { params: { q: term } });
        if (!cancelled) setMessageHits(res.data);
      } catch {
        if (!cancelled) setMessageHits([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);
  const titleOf = (conversationId) => {
    const conversation = conversations.find((c) => sameId(c, conversationId));
    return conversation ? conversationTitle(conversation, meId) : 'Chat';
  };
  // "Sales team · Emily Clarke", "Thomas Wright" (1-to-1, said by them), "Thomas Wright · You"
  const hitLabel = (hit) => {
    const title = titleOf(hit.conversation);
    const sender = sameId(hit.sender, meId) ? 'You' : getFullName(hit.sender);
    return sender === title ? title : `${title} · ${sender}`;
  };
  const shown = term ? conversations.filter((c) => conversationTitle(c, meId).toLowerCase().includes(term)) : conversations;
  const folderIds = new Set(folders.map((f) => f._id));

  // Favourites, Important, my folders (in my order, empty ones too unless searching), Chats
  const sections = [
    { key: 'favourites', label: 'Favourites', icon: Pin },
    { key: 'important', label: 'Important', icon: CircleAlert },
    ...folders.map((folder, index) => ({ key: `folder:${folder._id}`, label: folder.name, icon: Folder, folder, index })),
    { key: 'chats', label: 'Chats' },
  ]
    .map((section) => ({ ...section, items: shown.filter((c) => sectionOf(c, folderIds) === section.key) }))
    .filter((section) => section.items.length || (section.folder && !term));
  const showHeadings = sections.length > 1 || sections[0]?.key !== 'chats';

  const row = (conversation) => (
    <ConversationRow
      key={conversation._id}
      conversation={conversation}
      active={sameId(conversation, activeId)}
      meId={meId}
      folders={folders}
      onSelect={onSelect}
      onTogglePin={onTogglePin}
      onMoveToFolder={onMoveToFolder}
      onNewFolder={onNewFolder}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-lg font-semibold text-slate-900">Chat</h2>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={FolderPlus} label="New folder" onClick={() => onNewFolder()} />
          <Button size="sm" icon={MessageSquarePlus} onClick={onNewChat}>
            New chat
          </Button>
        </div>
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats and messages" className="form-control h-9 pl-9 text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!term && (
          <button
            onClick={onOpenSaved}
            className={clsx('mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition', savedActive ? 'bg-brand-50' : 'hover:bg-slate-50')}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Bookmark className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-slate-800">Saved messages</span>
          </button>
        )}

        {messageHits !== null && (
          <div className="mb-2">
            <p className="flex items-center gap-1 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <MessageSquareText className="h-3.5 w-3.5" /> Messages ({messageHits.length})
            </p>
            {!messageHits.length && <p className="px-3 py-1.5 text-xs text-slate-400">No messages match “{search.trim()}”</p>}
            {messageHits.map((hit) => (
              <button
                key={hit._id}
                onClick={() => onOpenMessage(hit.conversation, hit._id)}
                className="block w-full rounded-xl px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-slate-700">{hitLabel(hit)}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{listTime(hit.createdAt)}</span>
                </span>
                <span className="line-clamp-2 text-xs text-slate-500">
                  <Highlight text={messagePreview(hit)} term={search.trim()} />
                </span>
              </button>
            ))}
            {shown.length > 0 && <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Chats</p>}
          </div>
        )}
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

        {!loading && !shown.length && !folders.length && !messageHits?.length && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">{term ? 'No chats match your search' : 'No chats yet. Start one with "New chat".'}</p>
        )}

        {!loading &&
          sections.map((section) => {
            const Icon = section.icon;
            const isCollapsed = collapsed[section.key];
            return (
              <div key={section.key} className="mb-1">
                {showHeadings && (
                  <div className="group/head flex items-center">
                    <button
                      onClick={() => setCollapsed((c) => ({ ...c, [section.key]: !c[section.key] }))}
                      aria-expanded={!isCollapsed}
                      className="flex min-w-0 flex-1 items-center gap-1 px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
                    >
                      <ChevronDown className={clsx('h-3.5 w-3.5 shrink-0 transition', isCollapsed && '-rotate-90')} />
                      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{section.label}</span>
                      <span className="font-medium normal-case tracking-normal">({section.items.length})</span>
                    </button>
                    {section.folder && (
                      <ChatMenu
                        label={`Options for folder ${section.label}`}
                        className="mr-1 mt-1 opacity-0 focus-within:opacity-100 group-hover/head:opacity-100"
                        items={[
                          { label: 'Rename', icon: Pencil, onClick: () => onRenameFolder(section.folder) },
                          { label: 'Move up', icon: ArrowUp, disabled: section.index === 0, onClick: () => onMoveFolder(section.folder, -1) },
                          { label: 'Move down', icon: ArrowDown, disabled: section.index === folders.length - 1, onClick: () => onMoveFolder(section.folder, 1) },
                          { divider: true },
                          { label: 'Delete folder', icon: Trash2, danger: true, onClick: () => onDeleteFolder(section.folder) },
                        ]}
                      />
                    )}
                  </div>
                )}
                {!isCollapsed && section.items.map(row)}
                {!isCollapsed && section.folder && !section.items.length && (
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400">
                    <FolderInput className="h-3.5 w-3.5" /> Empty. Use a chat’s ⋯ menu → Move to folder.
                  </p>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
