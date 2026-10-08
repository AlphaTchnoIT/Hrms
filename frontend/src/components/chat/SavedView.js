'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Bookmark, BookmarkX, Folder, FolderMinus, FolderPlus, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { formatDateTime, getFullName } from '@/lib/format';
import { useChat } from '@/context/ChatContext';
import { Avatar, Button, EmptyState, Spinner, useConfirm } from '@/components/ui';
import ChatMenu from './ChatMenu';
import FolderNameModal from './FolderNameModal';
import { conversationTitle, messagePreview, sameId } from './chatUtils';

/*
 * My saved messages, in my own folders (separate from the chat-list folders).
 * filter: 'all' | 'none' (not in a folder) | <folderId>
 */
export default function SavedView({ conversations, meId, onOpenMessage, onBack }) {
  const { on } = useChat();
  const confirm = useConfirm();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [folderModal, setFolderModal] = useState(null); // {} new, { folder } rename

  const load = useCallback(async () => {
    try {
      const res = await api.get('/chat/saved', { params: filter === 'all' ? {} : { folder: filter } });
      setItems(res.data);
      setFolders(res.meta?.folders || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Saved / unsaved / folders changed here or in another tab
  useEffect(() => on('chat:saved', load), [on, load]);

  const activeFolder = folders.find((f) => f._id === filter);
  // The folder being shown was deleted (here or in another tab)
  useEffect(() => {
    if (!loading && filter !== 'all' && filter !== 'none' && !folders.some((f) => f._id === filter)) setFilter('all');
  }, [loading, filter, folders]);

  const titleOf = (conversationId) => {
    const conversation = conversations.find((c) => sameId(c, conversationId));
    return conversation ? conversationTitle(conversation, meId) : 'A chat you have left';
  };

  const run = async (request) => {
    try {
      const res = await request();
      if (res?.message) toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const moveTo = (item, folderId) => run(() => api.post('/chat/saved', { messageId: item.messageId, folderId }));
  const remove = (item) => run(() => api.delete(`/chat/saved/${item.messageId}`));

  const saveFolder = async (name) => {
    if (folderModal?.folder) await api.patch(`/chat/saved-folders/${folderModal.folder._id}`, { name });
    else {
      const res = await api.post('/chat/saved-folders', { name });
      setFilter(res.data._id);
    }
    await load();
  };

  const deleteFolder = async (folder) => {
    const ok = await confirm({
      title: `Delete folder "${folder.name}"?`,
      message: 'Its messages stay saved, just without a folder.',
      confirmText: 'Delete folder',
      danger: true,
    });
    if (!ok) return;
    setFilter('all');
    await run(() => api.delete(`/chat/saved-folders/${folder._id}`));
  };

  const chip = (key, label, icon) => {
    const Icon = icon;
    return (
      <button
        key={key}
        onClick={() => setFilter(key)}
        className={clsx(
          'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
          filter === key ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        )}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </button>
    );
  };

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="sm" icon={ArrowLeft} label="Back to chats" onClick={onBack} className="md:hidden" />
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Bookmark className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">Saved messages</p>
          <p className="text-xs text-slate-500">Only you can see these</p>
        </div>
        <Button size="sm" variant="secondary" icon={FolderPlus} onClick={() => setFolderModal({})}>
          New folder
        </Button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 px-3 py-2 sm:px-4">
        {chip('all', 'All')}
        {chip('none', 'Not in a folder')}
        {folders.map((folder) => chip(folder._id, folder.name, Folder))}
        {activeFolder && (
          <ChatMenu
            label={`Options for folder ${activeFolder.name}`}
            align="right"
            items={[
              { label: 'Rename folder', icon: Pencil, onClick: () => setFolderModal({ folder: activeFolder }) },
              { label: 'Delete folder', icon: Trash2, danger: true, onClick: () => deleteFolder(activeFolder) },
            ]}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/60 px-3 py-3 sm:px-5">
        {loading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {!loading && !items.length && (
          <EmptyState
            icon={Bookmark}
            title={filter === 'all' ? 'Nothing saved yet' : 'This folder is empty'}
            message="Hover a message and press the bookmark to save it here."
          />
        )}
        <ul className="space-y-2">
          {!loading &&
            items.map((item) => (
              <li key={item._id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-card">
                <div className="flex items-start gap-3">
                  {item.available ? (
                    <Avatar name={getFullName(item.message.sender)} src={item.message.sender?.avatar} size="sm" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <BookmarkX className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{item.available ? getFullName(item.message.sender) : 'Not available'}</span>
                      {' · '}
                      {titleOf(item.conversation)}
                      {item.available && ` · ${formatDateTime(item.message.createdAt)}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                      {item.available ? messagePreview(item.message) : 'This message is no longer available (deleted, expired, or you left the chat).'}
                    </p>
                    {item.folder && filter === 'all' && (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
                        <Folder className="h-3 w-3" /> {folders.find((f) => f._id === item.folder)?.name}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.available && (
                      <Button size="xs" variant="secondary" icon={MessageSquare} onClick={() => onOpenMessage(item.conversation, item.messageId)}>
                        Open
                      </Button>
                    )}
                    <ChatMenu
                      label="Saved message options"
                      items={[
                        ...(item.available
                          ? [
                              { heading: 'Move to folder' },
                              ...folders.map((folder) => ({
                                label: folder.name,
                                icon: Folder,
                                checked: item.folder === folder._id,
                                onClick: () => moveTo(item, folder._id),
                              })),
                              ...(item.folder ? [{ label: 'Remove from folder', icon: FolderMinus, onClick: () => moveTo(item, null) }] : []),
                              { divider: true },
                            ]
                          : []),
                        { label: 'Remove from saved', icon: BookmarkX, danger: true, onClick: () => remove(item) },
                      ]}
                    />
                  </div>
                </div>
              </li>
            ))}
        </ul>
      </div>

      <FolderNameModal
        open={Boolean(folderModal)}
        initialName={folderModal?.folder?.name || ''}
        description="A folder for your saved messages. Only you see it."
        onClose={() => setFolderModal(null)}
        onSave={saveFolder}
      />
    </div>
  );
}
