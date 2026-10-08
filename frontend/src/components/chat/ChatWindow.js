'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { ArrowDown, ArrowLeft, Bell, BellOff, CircleAlert, CornerUpLeft, Info, Paperclip, Pencil, Phone, Pin, PinOff, SendHorizontal, Siren, Smile, X } from 'lucide-react';
import api from '@/lib/api';
import { getFullName } from '@/lib/format';
import { useCall } from '@/context/CallContext';
import { useChat } from '@/context/ChatContext';
import { Button, Spinner, useConfirm } from '@/components/ui';
import { GroupAvatar, PresenceAvatar } from './PresenceAvatar';
import EmojiPicker from './EmojiPicker';
import MessageItem from './MessageItem';
import PriorityMenu from './PriorityMenu';
import SeenByModal from './SeenByModal';
import {
  CHAT_FILE_ACCEPT,
  CHAT_PRIORITIES,
  PRESENCE_LABEL,
  conversationTitle,
  dayLabel,
  fileProblem,
  fileSize,
  fullNameOf,
  isImageName,
  mentionAt,
  messagePreview,
  otherMember,
  presenceOf,
  sameId,
} from './chatUtils';

const MAX_LENGTH = 4000;
const TYPING_SEND_EVERY = 3000; // re-send "typing" at most every 3s while typing
const TYPING_SHOW_FOR = 5000; // hide someone's "typing" if nothing new arrives
const GROUP_WITHIN_MS = 5 * 60 * 1000; // messages from the same person within 5 min are grouped

function Divider({ children, tone = 'slate' }) {
  const colors = tone === 'red' ? 'text-red-500 [&>span]:bg-red-200' : 'text-slate-400 [&>span]:bg-slate-200';
  return (
    <div className={`my-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide ${colors}`}>
      <span className="h-px flex-1" />
      {children}
      <span className="h-px flex-1" />
    </div>
  );
}

export default function ChatWindow({ conversation, meId, focus, onBack, onOpenInfo, onRead, onPrefsChange, onTogglePin }) {
  const chat = useChat();
  const { on, sendTyping, setActiveConversation } = chat;
  const confirm = useConfirm();
  const { call, startCall, activeCalls, maxParticipants } = useCall();
  const id = conversation._id;

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  // Opened at an older message (search / saved): newer messages exist below what is loaded
  const [hasNewer, setHasNewer] = useState(false);
  const hasNewerRef = useRef(false);
  hasNewerRef.current = hasNewer;
  const focusKey = focus ? `${focus.messageId}:${focus.at}` : '';
  const focusRef = useRef(focus);
  focusRef.current = focus;
  const shownFocus = useRef(focusKey);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState({}); // userId -> true
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [actionsFor, setActionsFor] = useState(null); // message showing its actions (tap on mobile)
  const [highlightId, setHighlightId] = useState(null);
  const [newFromId, setNewFromId] = useState(null); // first unread message when the chat was opened
  const [pending, setPending] = useState(null); // { file, previewUrl } waiting to be sent
  const [uploadProgress, setUploadProgress] = useState(null); // 0-100 while uploading
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [priority, setPriority] = useState('standard'); // of the next message
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [seenByMessage, setSeenByMessage] = useState(null);
  const [mention, setMention] = useState(null); // { query, start } while typing "@name"
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionIds = useRef(new Map()); // "Full Name" -> user id, for people picked from the @ list
  const closePriority = useCallback(() => setPriorityOpen(false), []);
  const fileInputRef = useRef(null);
  const closeEmoji = useCallback(() => setEmojiOpen(false), []);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const stickToBottom = useRef(true);
  const restoreHeight = useRef(null); // keeps the view still when older messages are added on top
  const typingTimers = useRef({});
  const lastTypingSent = useRef(0);
  const stopTypingTimer = useRef(null);
  const readTimer = useRef(null);
  const membersRef = useRef(conversation.members);
  membersRef.current = conversation.members;
  const onReadRef = useRef(onRead); // a ref so a new onRead from the parent never reloads the chat
  onReadRef.current = onRead;
  const unreadAtOpen = useRef(conversation.unread);

  const isGroup = conversation.type === 'group';
  const other = isGroup ? null : otherMember(conversation, meId);
  const otherLeft = other && other.status !== 'active';

  const markRead = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      api
        .post(`/chat/conversations/${id}/read`)
        .then(() => onReadRef.current(id))
        .catch(() => {});
    }, 400);
  }, [id]);

  // Load the latest messages when a chat is opened
  useEffect(() => {
    let cancelled = false;
    const me = membersRef.current.find((m) => sameId(m, meId));
    const readUpTo = me?.lastReadAt ? new Date(me.lastReadAt) : null;
    const hadUnread = unreadAtOpen.current > 0;
    setLoading(true);
    setMessages([]);
    setTyping({});
    setText('');
    setReplyTo(null);
    setEditing(null);
    setNewFromId(null);
    // Opened from a search result / saved message: start around that message instead of the latest
    const around = focusRef.current?.messageId;
    stickToBottom.current = !around;
    api
      .get(`/chat/conversations/${id}/messages`, { params: around ? { around } : {} })
      .then((res) => {
        if (cancelled) return;
        setMessages(res.data);
        setHasMore(Boolean(res.meta?.hasMore));
        setHasNewer(Boolean(res.meta?.hasNewer));
        if (around) setTimeout(() => jumpTo(around), 60);
        if (hadUnread && !around) {
          const first = res.data.find((m) => m.type !== 'system' && !sameId(m.sender, meId) && (!readUpTo || new Date(m.createdAt) > readUpTo));
          setNewFromId(first?._id || null);
        }
      })
      .catch((err) => !cancelled && toast.error(err.message))
      .finally(() => !cancelled && setLoading(false));

    setActiveConversation(id);
    markRead();
    const onVisible = () => document.visibilityState === 'visible' && markRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      setActiveConversation(null);
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(readTimer.current);
    };
  }, [id, meId, setActiveConversation, markRead]);

  // Keeps my own "saved" flag (the server doesn't send it with live updates)
  const replaceMessage = useCallback(
    (message) => setMessages((previous) => previous.map((m) => (m._id === message._id ? { ...message, saved: message.saved ?? m.saved } : m))),
    []
  );

  // Back to the newest messages (after jumping to an older one)
  const loadLatest = useCallback(async () => {
    try {
      const res = await api.get(`/chat/conversations/${id}/messages`);
      stickToBottom.current = true;
      setMessages(res.data);
      setHasMore(Boolean(res.meta?.hasMore));
      setHasNewer(false);
    } catch (err) {
      toast.error(err.message);
    }
  }, [id]);

  // Another search result / saved message in this same chat was opened
  useEffect(() => {
    if (!focusKey || focusKey === shownFocus.current) return;
    shownFocus.current = focusKey;
    const target = focusRef.current.messageId;
    if (document.getElementById(`msg-${target}`)) {
      jumpTo(target);
      return;
    }
    api
      .get(`/chat/conversations/${id}/messages`, { params: { around: target } })
      .then((res) => {
        stickToBottom.current = false;
        setMessages(res.data);
        setHasMore(Boolean(res.meta?.hasMore));
        setHasNewer(Boolean(res.meta?.hasNewer));
        setTimeout(() => jumpTo(target), 60);
      })
      .catch((err) => toast.error(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, id]);

  // Live events for this chat
  useEffect(() => {
    const clearTyping = (userId) => {
      clearTimeout(typingTimers.current[userId]);
      setTyping((previous) => {
        if (!previous[userId]) return previous;
        const next = { ...previous };
        delete next[userId];
        return next;
      });
    };

    const offs = [
      on('message:new', ({ conversationId, message }) => {
        if (conversationId !== id) return;
        // Looking at older messages: don't append after a gap, "Jump to latest" shows it
        if (!hasNewerRef.current) setMessages((previous) => (previous.some((m) => m._id === message._id) ? previous : [...previous, message]));
        if (message.sender?._id) clearTyping(message.sender._id);
        if (!sameId(message.sender, meId)) markRead();
      }),
      on('message:updated', ({ conversationId, message }) => conversationId === id && replaceMessage(message)),
      // Saved / unsaved (maybe in another tab)
      on('chat:saved', ({ messageId, saved }) => {
        if (messageId) setMessages((previous) => previous.map((m) => (m._id === messageId ? { ...m, saved } : m)));
      }),
      // A file reached the 90-day limit and was removed
      on('message:file-removed', ({ conversationId, messageId }) => {
        if (conversationId !== id) return;
        const removedAt = new Date().toISOString();
        setMessages((previous) => previous.map((m) => (m._id === messageId && m.attachment ? { ...m, attachment: { ...m.attachment, removedAt } } : m)));
      }),
      on('message:deleted', ({ conversationId, messageId }) => {
        if (conversationId !== id) return;
        setMessages((previous) =>
          previous.map((m) => {
            if (m._id === messageId) return { ...m, text: '', reactions: [], replyTo: null, deletedAt: new Date().toISOString() };
            // quotes of the deleted message lose their text too
            if (m.replyTo?._id === messageId) return { ...m, replyTo: { ...m.replyTo, text: '', deletedAt: new Date().toISOString() } };
            return m;
          })
        );
      }),
      on('typing', ({ conversationId, userId, isTyping }) => {
        if (conversationId !== id) return;
        if (!isTyping) return clearTyping(userId);
        clearTimeout(typingTimers.current[userId]);
        typingTimers.current[userId] = setTimeout(() => clearTyping(userId), TYPING_SHOW_FOR);
        return setTyping((previous) => ({ ...previous, [userId]: true }));
      }),
    ];

    const timers = typingTimers.current;
    return () => {
      offs.forEach((off) => off());
      Object.values(timers).forEach(clearTimeout);
    };
  }, [id, meId, on, markRead, replaceMessage]);

  // Scroll: stay at the bottom for new messages, stay still when older ones load
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    if (restoreHeight.current !== null) {
      box.scrollTop += box.scrollHeight - restoreHeight.current;
      restoreHeight.current = null;
    } else if (stickToBottom.current) {
      box.scrollTop = box.scrollHeight;
    }
  }, [messages, typing]);

  const onScroll = () => {
    const box = scrollRef.current;
    stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  };

  const loadOlder = async () => {
    if (!messages.length) return;
    setLoadingOlder(true);
    try {
      const res = await api.get(`/chat/conversations/${id}/messages`, { params: { before: messages[0].createdAt } });
      restoreHeight.current = scrollRef.current?.scrollHeight ?? null;
      setMessages((previous) => [...res.data.filter((m) => !previous.some((p) => p._id === m._id)), ...previous]);
      setHasMore(Boolean(res.meta?.hasMore));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const resizeInput = () => {
    const box = inputRef.current;
    if (!box) return;
    box.style.height = 'auto';
    box.style.height = `${Math.min(box.scrollHeight, 140)}px`;
  };

  const stopTyping = () => {
    clearTimeout(stopTypingTimer.current);
    if (lastTypingSent.current) sendTyping(id, false);
    lastTypingSent.current = 0;
  };

  const onType = (value) => {
    setText(value);
    resizeInput();
    // "@na…" just before the cursor (groups only) opens the people list
    const found = isGroup && !editing ? mentionAt(value, inputRef.current?.selectionStart ?? value.length) : null;
    setMention(found);
    if (found) setMentionIndex(0);
    if (editing || !value.trim()) return stopTyping();
    if (Date.now() - lastTypingSent.current > TYPING_SEND_EVERY) {
      sendTyping(id, true);
      lastTypingSent.current = Date.now();
    }
    clearTimeout(stopTypingTimer.current);
    stopTypingTimer.current = setTimeout(stopTyping, TYPING_SEND_EVERY);
    return undefined;
  };

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const startReply = (message) => {
    setEditing(null);
    setReplyTo(message);
    setActionsFor(null);
    focusInput();
  };

  const startEdit = (message) => {
    setReplyTo(null);
    setEditing(message);
    setText(message.text);
    setActionsFor(null);
    focusInput();
    setTimeout(resizeInput, 0);
  };

  const cancelComposerMode = () => {
    if (editing) setText('');
    setEditing(null);
    setReplyTo(null);
    setTimeout(resizeInput, 0);
  };

  // A photo / document waiting to be sent (chosen, pasted or dropped)
  const attachFile = (file) => {
    if (!file || editing) return;
    const problem = fileProblem(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setPending({ file, previewUrl: isImageName(file.name) ? URL.createObjectURL(file) : null });
    focusInput();
  };

  const clearPending = () => setPending(null);

  // Free the preview of the previous file (and on leaving the chat)
  useEffect(() => () => pending?.previewUrl && URL.revokeObjectURL(pending.previewUrl), [pending]);

  const addMessage = (message) => setMessages((previous) => (previous.some((m) => m._id === message._id) ? previous : [...previous, message]));

  const sendFile = async (caption, quoting) => {
    const form = new FormData();
    form.append('file', pending.file);
    if (caption) form.append('text', caption);
    if (quoting) form.append('replyTo', quoting._id);
    form.append('priority', priority);
    setUploadProgress(0);
    try {
      const res = await api.post(`/chat/conversations/${id}/attachments`, form, {
        timeout: 120000,
        onUploadProgress: (e) => e.total && setUploadProgress(Math.round((e.loaded / e.total) * 100)),
      });
      clearPending();
      setText('');
      setReplyTo(null);
      setPriority('standard');
      setTimeout(resizeInput, 0);
      stickToBottom.current = true;
      if (hasNewerRef.current) await loadLatest(); // was looking at older messages
      else addMessage(res.data);
    } catch (err) {
      toast.error(err.errors?.file || err.message);
    } finally {
      setUploadProgress(null);
    }
  };

  const send = async () => {
    const body = text.trim();
    if (otherLeft || uploadProgress !== null) return;
    setEmojiOpen(false);
    if (pending && !editing) {
      stopTyping();
      await sendFile(body, replyTo);
      return;
    }
    if (!body) return;
    const quoting = replyTo;
    const editingMessage = editing;
    const sendPriority = priority;
    // Only people whose "@Full Name" is still in the text count as mentioned
    const mentions = [...mentionIds.current].filter(([name]) => body.includes(`@${name}`)).map(([, userId]) => userId);
    setText('');
    setReplyTo(null);
    setEditing(null);
    setMention(null);
    setTimeout(resizeInput, 0);
    stopTyping();
    try {
      if (editingMessage) {
        if (body === editingMessage.text) return;
        const res = await api.patch(`/chat/messages/${editingMessage._id}`, { text: body });
        replaceMessage(res.data);
        return;
      }
      stickToBottom.current = true;
      const res = await api.post(`/chat/conversations/${id}/messages`, { text: body, replyTo: quoting?._id, priority: sendPriority, mentions });
      if (hasNewerRef.current) await loadLatest(); // was looking at older messages
      else addMessage(res.data);
      setPriority('standard');
      mentionIds.current.clear();
    } catch (err) {
      // keep what they wrote so they can try again
      setText(body);
      setReplyTo(quoting);
      setEditing(editingMessage);
      toast.error(err.message);
    }
  };

  // People offered while typing "@…" (not me), best matches first
  const mentionOptions = mention
    ? conversation.members
        .filter((m) => !sameId(m, meId) && fullNameOf(m).toLowerCase().includes(mention.query))
        .sort((a, b) => Number(!fullNameOf(a).toLowerCase().startsWith(mention.query)) - Number(!fullNameOf(b).toLowerCase().startsWith(mention.query)))
        .slice(0, 6)
    : [];

  // Replaces the "@na" being typed with "@Full Name "
  const pickMention = (member) => {
    const name = fullNameOf(member);
    const cursor = inputRef.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, mention.start)}@${name} ${text.slice(cursor)}`;
    mentionIds.current.set(name, member._id);
    setText(next);
    setMention(null);
    const caret = mention.start + name.length + 2;
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caret, caret);
      resizeInput();
    }, 0);
  };

  // Puts an emoji where the cursor is
  const insertEmoji = (emoji) => {
    const box = inputRef.current;
    const start = box?.selectionStart ?? text.length;
    const end = box?.selectionEnd ?? text.length;
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`.slice(0, MAX_LENGTH);
    setText(next);
    setTimeout(() => {
      box?.focus();
      box?.setSelectionRange(start + emoji.length, start + emoji.length);
      resizeInput();
    }, 0);
  };

  const onPaste = (e) => {
    const file = e.clipboardData?.files?.[0];
    if (file) {
      e.preventDefault();
      attachFile(file);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (!otherLeft) attachFile(e.dataTransfer?.files?.[0]);
  };

  const onKeyDown = (e) => {
    // The @ list takes the arrow keys, Enter / Tab and Escape while it is open
    if (mentionOptions.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setMentionIndex((i) => (i + step + mentionOptions.length) % mentionOptions.length);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault();
        pickMention(mentionOptions[mentionIndex] || mentionOptions[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    } else if (e.key === 'Escape' && (replyTo || editing)) {
      cancelComposerMode();
    } else if (e.key === 'ArrowUp' && !text) {
      // Up arrow on an empty box edits my last message (like Teams / Slack)
      const last = [...messages].reverse().find((m) => m.type !== 'system' && !m.deletedAt && sameId(m.sender, meId));
      if (last) {
        e.preventDefault();
        startEdit(last);
      }
    }
  };

  const react = async (message, emoji) => {
    setActionsFor(null);
    try {
      const res = await api.post(`/chat/messages/${message._id}/reactions`, { emoji });
      replaceMessage(res.data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Bookmark / un-bookmark a message (my "Saved messages")
  const toggleSave = async (message) => {
    setActionsFor(null);
    try {
      const res = message.saved ? await api.delete(`/chat/saved/${message._id}`) : await api.post('/chat/saved', { messageId: message._id });
      setMessages((previous) => previous.map((m) => (m._id === message._id ? { ...m, saved: !message.saved } : m)));
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (message) => {
    setActionsFor(null);
    const ok = await confirm({ title: 'Delete message?', message: 'It will be removed for everyone in this chat.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/chat/messages/${message._id}`);
      if (editing?._id === message._id) cancelComposerMode();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const jumpTo = (messageId) => {
    const element = document.getElementById(`msg-${messageId}`);
    if (!element) {
      toast('Load older messages to see it', { icon: 'ℹ️' });
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(messageId);
    setTimeout(() => setHighlightId(null), 1600);
  };

  const toggleMute = async () => {
    const muted = !conversation.muted;
    try {
      await api.patch(`/chat/conversations/${id}/mute`, { muted });
      chat.setMuted(id, muted);
      onPrefsChange(id, { muted });
      toast.success(muted ? 'Muted: no pop-ups or sounds for this chat' : 'Unmuted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // "Seen" under my latest message
  const lastMine = [...messages].reverse().find((m) => m.type !== 'system' && sameId(m.sender, meId));
  const seenBy = lastMine
    ? conversation.members.filter((m) => !sameId(m, meId) && m.lastReadAt && new Date(m.lastReadAt) >= new Date(lastMine.createdAt))
    : [];
  let seenLabel = '';
  if (seenBy.length) {
    if (!isGroup) seenLabel = 'Seen';
    else seenLabel = seenBy.length === conversation.members.length - 1 ? 'Seen by everyone' : `Seen by ${seenBy.length}`;
  }

  const typingNames = Object.keys(typing)
    .map((userId) => membersRef.current.find((m) => sameId(m, userId)))
    .filter(Boolean)
    .map((m) => m.firstName);

  const status = other ? presenceOf(other._id, chat) : null;
  const liveCall = isGroup ? activeCalls[id] : null;
  const liveCallFull = Boolean(liveCall && liveCall.participants.length >= maxParticipants);
  const callNow = () => startCall({ conversationId: id, isGroup, title: conversationTitle(conversation, meId), peer: other });

  return (
    <div
      className="relative flex h-full w-full min-w-0 flex-col"
      onDragOver={(e) => {
        if (otherLeft || !e.dataTransfer?.types?.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50/90 text-sm font-semibold text-brand-700">
          Drop to attach (photos and documents up to 5 MB)
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="sm" icon={ArrowLeft} label="Back to chats" onClick={onBack} className="md:hidden" />
        {isGroup ? <GroupAvatar /> : <PresenceAvatar user={other} />}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{conversationTitle(conversation, meId)}</p>
          <p className="truncate text-xs text-slate-500">
            {isGroup && `${conversation.members.length} members`}
            {!isGroup && (otherLeft ? 'No longer with the company' : [PRESENCE_LABEL[status], other.designation?.title].filter(Boolean).join(' · '))}
          </p>
        </div>
        {!otherLeft && (
          <Button
            variant="ghost"
            size="sm"
            icon={Phone}
            label={isGroup ? (liveCall ? 'Join the group call' : 'Group audio call') : status === 'offline' ? `Audio call (${other.firstName} is offline)` : 'Audio call'}
            onClick={callNow}
            disabled={Boolean(call) || liveCallFull}
            className="text-emerald-600 hover:text-emerald-700"
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={conversation.muted ? BellOff : Bell}
          label={conversation.muted ? 'Unmute chat' : 'Mute chat'}
          onClick={toggleMute}
          className={conversation.muted ? 'text-amber-600' : undefined}
        />
        <Button
          variant="ghost"
          size="sm"
          icon={conversation.pinned ? PinOff : Pin}
          label={conversation.pinned ? 'Remove from Favourites' : 'Add to Favourites'}
          onClick={onTogglePin}
          className={conversation.pinned ? 'text-brand-600' : undefined}
        />
        {isGroup && <Button variant="ghost" size="sm" icon={Info} label="Group info" onClick={onOpenInfo} />}
      </div>

      {/* A group call is going on and I'm not in it */}
      {liveCall && call?.id !== liveCall.callId && (
        <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-3 py-2 text-sm sm:px-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="min-w-0 flex-1 truncate text-emerald-800">
            Group call going on · {liveCall.participants.length} {liveCall.participants.length === 1 ? 'person' : 'people'}
            {liveCallFull && ' · full'}
          </span>
          <Button variant="success" size="xs" icon={Phone} onClick={callNow} disabled={Boolean(call) || liveCallFull}>
            Join
          </Button>
        </div>
      )}

      {/* Messages (extra top padding leaves room for the first message's action bar) */}
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto bg-slate-50/60 px-3 pb-4 pt-10 sm:px-5">
        {loading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {!loading && hasMore && (
          <div className="mb-3 flex justify-center">
            <Button variant="secondary" size="xs" onClick={loadOlder} loading={loadingOlder}>
              Load older messages
            </Button>
          </div>
        )}
        {!loading && !messages.length && <p className="py-10 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
          const isNewStart = message._id === newFromId;
          const dividers = (
            <>
              {newDay && <Divider>{dayLabel(message.createdAt)}</Divider>}
              {isNewStart && <Divider tone="red">New messages</Divider>}
            </>
          );

          if (message.type === 'system') {
            return (
              <Fragment key={message._id}>
                {dividers}
                <p className="my-2 text-center text-xs text-slate-500">{message.text}</p>
              </Fragment>
            );
          }

          const continued =
            !newDay &&
            !isNewStart &&
            previous?.type !== 'system' &&
            sameId(previous?.sender, message.sender) &&
            new Date(message.createdAt) - new Date(previous.createdAt) < GROUP_WITHIN_MS;

          return (
            <Fragment key={message._id}>
              {dividers}
              <MessageItem
                message={message}
                meId={meId}
                members={conversation.members}
                isGroup={isGroup}
                continued={continued}
                seenLabel={message._id === lastMine?._id ? seenLabel : ''}
                showActions={actionsFor === message._id}
                highlighted={highlightId === message._id}
                onToggleActions={() => setActionsFor((current) => (current === message._id ? null : message._id))}
                onReact={(emoji) => react(message, emoji)}
                onReply={() => startReply(message)}
                onEdit={() => startEdit(message)}
                onDelete={() => remove(message)}
                onJumpTo={jumpTo}
                onToggleSave={() => toggleSave(message)}
                onSeenBy={() => {
                  setActionsFor(null);
                  setSeenByMessage(message);
                }}
              />
            </Fragment>
          );
        })}

        {hasNewer && (
          <div className="sticky bottom-2 z-10 mt-4 flex justify-center">
            <Button size="sm" icon={ArrowDown} onClick={loadLatest} className="shadow-pop">
              Jump to latest
            </Button>
          </div>
        )}

        {typingNames.length > 0 && (
          <p className="mt-3 animate-pulse px-1 text-xs italic text-slate-500">
            {typingNames.join(', ')} {typingNames.length === 1 ? 'is' : 'are'} typing…
          </p>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-100 p-3">
        {otherLeft ? (
          <p className="py-2 text-center text-sm text-slate-500">You can no longer message {getFullName(other)}.</p>
        ) : (
          <>
            {(replyTo || editing) && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-brand-400 bg-brand-50/60 px-3 py-2 text-xs">
                {editing ? <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> : <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-700">{editing ? 'Editing message' : `Replying to ${sameId(replyTo.sender, meId) ? 'yourself' : getFullName(replyTo.sender)}`}</p>
                  {replyTo && <p className="truncate text-slate-500">{messagePreview(replyTo)}</p>}
                </div>
                <button onClick={cancelComposerMode} aria-label="Cancel" className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {pending && !editing && (
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {pending.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pending.previewUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                    <Paperclip className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1 text-xs">
                  <p className="truncate font-medium text-slate-800">{pending.file.name}</p>
                  <p className="text-slate-500">
                    {uploadProgress === null ? `${fileSize(pending.file.size)} · add a message or press Send` : `Uploading… ${uploadProgress}%`}
                  </p>
                  {uploadProgress !== null && (
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-brand-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
                {uploadProgress === null && (
                  <button onClick={clearPending} aria-label="Remove file" className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
            {priority !== 'standard' && !editing && (
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-red-600">
                {priority === 'urgent' ? <Siren className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
                This message will be sent as {CHAT_PRIORITIES[priority].label}
                <button onClick={() => setPriority('standard')} aria-label="Back to standard" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div className="relative flex items-end gap-1.5">
              {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={closeEmoji} />}
              {priorityOpen && (
                <PriorityMenu
                  value={priority}
                  onPick={(value) => {
                    setPriority(value);
                    setPriorityOpen(false);
                    focusInput();
                  }}
                  onClose={closePriority}
                />
              )}
              {mentionOptions.length > 0 && (
                <ul role="listbox" aria-label="Mention someone" className="absolute bottom-full left-24 z-20 mb-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-pop">
                  {mentionOptions.map((member, i) => (
                    <li key={member._id} role="option" aria-selected={i === mentionIndex}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()} // keep the cursor in the message box
                        onClick={() => pickMention(member)}
                        className={clsx('flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm', i === mentionIndex ? 'bg-brand-50' : 'hover:bg-slate-50')}
                      >
                        <PresenceAvatar user={member} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-slate-800">{fullNameOf(member)}</span>
                          <span className="block truncate text-[11px] text-slate-500">{member.designation?.title || member.email}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Button variant="ghost" icon={Smile} label="Emoji" onClick={() => setEmojiOpen((v) => !v)} />
              {!editing && (
                <>
                  <Button
                    variant="ghost"
                    icon={priority === 'urgent' ? Siren : CircleAlert}
                    label="Set delivery options (Standard, Important, Urgent)"
                    onClick={() => setPriorityOpen((v) => !v)}
                    className={priority !== 'standard' ? 'text-red-600' : undefined}
                  />
                  <Button variant="ghost" icon={Paperclip} label="Attach a photo or file (max 5 MB)" onClick={() => fileInputRef.current?.click()} />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={CHAT_FILE_ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                      attachFile(e.target.files?.[0]);
                      e.target.value = ''; // the same file can be picked again
                    }}
                  />
                </>
              )}
              <textarea
                ref={inputRef}
                rows={1}
                value={text}
                maxLength={MAX_LENGTH}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                placeholder={pending ? 'Add a message (optional)' : 'Type a message'}
                className="form-control max-h-36 min-h-10 flex-1 resize-none py-2"
              />
              <Button
                icon={SendHorizontal}
                label={editing ? 'Save' : 'Send'}
                onClick={send}
                loading={uploadProgress !== null}
                disabled={!text.trim() && !(pending && !editing)}
              />
            </div>
          </>
        )}
        {chat.connected ? (
          // Keyboard tips only where there is a keyboard and room for them
          !otherLeft && <p className="mt-1.5 hidden text-[11px] text-slate-400 sm:block">Enter to send · Shift + Enter for a new line · ↑ to edit your last message</p>
        ) : (
          <p className="mt-1.5 text-xs text-amber-600">Reconnecting… new messages will appear once you are back online.</p>
        )}
      </div>

      {seenByMessage && <SeenByModal message={seenByMessage} members={conversation.members} meId={meId} onClose={() => setSeenByMessage(null)} />}
    </div>
  );
}
