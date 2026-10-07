'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import api, { getServerUrl, tokenStorage } from '@/lib/api';
import { appForPath, openApp } from '@/lib/apps';
import { messagePreview } from '@/components/chat/chatUtils';
import { getFullName } from '@/lib/format';
import { useAuth } from './AuthContext';

/*
 * One live chat connection for the whole app (Socket.IO).
 * Keeps who is online / on leave, the unread badge and muted chats. For a new message it plays a
 * short sound and shows a pop-up (outside the chat page) or a desktop notification (tab in the background).
 * The chat page listens to events with on(event, handler); "ui:open" asks it to show a chat.
 */
const ChatContext = createContext(null);

// Events the server pushes (see backend/src/chat/chat.socket.js)
const EVENTS = ['message:new', 'message:updated', 'message:deleted', 'message:file-removed', 'conversation:updated', 'conversation:removed', 'conversation:read', 'conversation:muted', 'typing'];

const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

// Short two-tone "ping" made in the browser (no sound file). Browsers allow it after the first click on the page.
let audioContext;
function playPing() {
  try {
    audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    [880, 1320].forEach((frequency, i) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.18);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + i * 0.09);
      oscillator.stop(now + i * 0.09 + 0.2);
    });
  } catch {
    /* no audio, never mind */
  }
}

export function ChatProvider({ children }) {
  const { user, features } = useAuth();
  const enabled = Boolean(user && features.chat && !user.mustChangePassword);
  const userId = user?._id;

  const socketRef = useRef(null);
  const listeners = useRef(new Map()); // event -> Set of handlers
  const activeConversationId = useRef(null); // the chat open on screen right now
  const mutedRef = useRef(new Set());
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(() => new Set());
  const [onLeave, setOnLeave] = useState(() => new Set());
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState('unsupported');

  useEffect(() => {
    if (notificationsSupported()) setNotificationPermission(Notification.permission);
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await api.get('/chat/unread');
      setUnreadTotal(res.data.total);
      mutedRef.current = new Set(res.data.muted || []);
    } catch {
      /* not critical */
    }
  }, []);

  const refreshPresence = useCallback(async () => {
    try {
      const res = await api.get('/chat/presence');
      setOnline(new Set(res.data.online));
      setOnLeave(new Set(res.data.onLeave));
    } catch {
      /* not critical */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    // auth as a function: every reconnect sends the current token
    const socket = io(getServerUrl(), { auth: (send) => send({ token: tokenStorage.get() }) });
    socketRef.current = socket;
    const handlers = listeners.current;
    EVENTS.forEach((event) => socket.on(event, (payload) => handlers.get(event)?.forEach((fn) => fn(payload))));

    // (Re)connected: catch up on anything missed while offline
    socket.on('connect', () => {
      setConnected(true);
      refreshPresence();
      refreshUnread();
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('presence', ({ userId: id, online: isOnline }) =>
      setOnline((previous) => {
        const next = new Set(previous);
        if (isOnline) next.add(id);
        else next.delete(id);
        return next;
      })
    );

    // In the chat tab: switch to that chat. In HRMS: open (or bring back) the chat tab on it.
    const openChat = (conversationId) => {
      if (appForPath(window.location.pathname) === 'chat') handlers.get('ui:open')?.forEach((fn) => fn(conversationId));
      else openApp('chat', `/chat?c=${conversationId}`);
    };

    socket.on('message:new', ({ conversationId, message }) => {
      if (message.type === 'system' || message.sender?._id === userId) return;
      const hidden = document.visibilityState !== 'visible';
      if (activeConversationId.current === conversationId && !hidden) return;
      setUnreadTotal((n) => n + 1);
      if (mutedRef.current.has(conversationId)) return;

      playPing();
      const name = getFullName(message.sender);
      if (hidden && notificationsSupported() && Notification.permission === 'granted') {
        // tag: a new message from the same chat replaces the previous notification
        const notification = new Notification(name, { body: messagePreview(message), tag: conversationId });
        notification.onclick = () => {
          window.focus();
          openChat(conversationId);
          notification.close();
        };
      } else if (appForPath(window.location.pathname) !== 'chat') {
        toast(
          (t) => (
            <button
              className="block max-w-xs text-left"
              onClick={() => {
                toast.dismiss(t.id);
                openChat(conversationId);
              }}
            >
              <span className="block text-sm font-semibold text-slate-800">{name}</span>
              <span className="line-clamp-2 text-sm text-slate-600">{messagePreview(message)}</span>
            </button>
          ),
          { icon: '💬', duration: 5000 }
        );
      }
    });

    socket.on('conversation:read', ({ userId: readerId }) => readerId === userId && refreshUnread());
    socket.on('conversation:removed', refreshUnread);
    // Muted / unmuted in another tab or device
    socket.on('conversation:muted', ({ conversationId, muted }) => {
      if (muted) mutedRef.current.add(conversationId);
      else mutedRef.current.delete(conversationId);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, userId, refreshPresence, refreshUnread]);

  // Subscribe to a socket event; returns the unsubscribe function (use inside useEffect)
  const on = useCallback((event, handler) => {
    const handlers = listeners.current;
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(handler);
    return () => handlers.get(event).delete(handler);
  }, []);

  const sendTyping = useCallback((conversationId, isTyping) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  const setActiveConversation = useCallback((id) => {
    activeConversationId.current = id;
  }, []);

  const setMuted = useCallback((conversationId, muted) => {
    if (muted) mutedRef.current.add(conversationId);
    else mutedRef.current.delete(conversationId);
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!notificationsSupported()) return;
    setNotificationPermission(await Notification.requestPermission());
  }, []);

  const value = useMemo(
    () => ({
      enabled,
      connected,
      online,
      onLeave,
      unreadTotal,
      notificationPermission,
      refreshUnread,
      on,
      sendTyping,
      setActiveConversation,
      setMuted,
      enableNotifications,
    }),
    [enabled, connected, online, onLeave, unreadTotal, notificationPermission, refreshUnread, on, sendTyping, setActiveConversation, setMuted, enableNotifications]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside <ChatProvider>');
  return context;
}
