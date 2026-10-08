'use client';

import { useEffect } from 'react';
import { LogOut, MessageSquare } from 'lucide-react';
import SessionGate from '@/components/auth/SessionGate';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';
import { ChatProvider, useChat } from '@/context/ChatContext';
import { claimTab } from '@/lib/apps';
import AppSwitcher from './AppSwitcher';

const TITLE = 'PeopleHub Chat';

function ChatHeader() {
  const { user, logout } = useAuth();
  const { unreadTotal, connected } = useChat();

  // "(3) PeopleHub Chat" in the browser tab
  useEffect(() => {
    document.title = unreadTotal ? `(${unreadTotal > 99 ? '99+' : unreadTotal}) ${TITLE}` : TITLE;
  }, [unreadTotal]);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm">
          <MessageSquare className="h-4 w-4" />
        </span>
        <span className="hidden text-[15px] font-bold tracking-tight text-slate-900 sm:block">{TITLE}</span>
        <span
          title={connected ? 'Connected' : 'Reconnecting…'}
          className={connected ? 'h-2 w-2 rounded-full bg-emerald-500' : 'h-2 w-2 animate-pulse rounded-full bg-amber-500'}
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <AppSwitcher current="chat" />
        <div className="hidden items-center gap-2 md:flex">
          <Avatar name={user.fullName} src={user.avatar} size="sm" />
          <span className="max-w-40 truncate text-sm font-medium text-slate-700">{user.fullName}</span>
        </div>
        <button onClick={logout} aria-label="Logout" title="Logout" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

// Chat as its own full-screen app (same login as HRMS), meant to run in its own tab
export default function ChatShell({ children }) {
  useEffect(() => claimTab('chat'), []);

  return (
    <SessionGate loadingText="Loading your chats…">
      <ChatProvider>
        <CallProvider>
          <div className="flex h-[100dvh] flex-col bg-surface">
            <ChatHeader />
            <main className="min-h-0 flex-1 sm:p-4">{children}</main>
          </div>
        </CallProvider>
      </ChatProvider>
    </SessionGate>
  );
}
