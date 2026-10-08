'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import SessionGate from '@/components/auth/SessionGate';
import { CallProvider } from '@/context/CallContext';
import { ChatProvider } from '@/context/ChatContext';
import { claimTab } from '@/lib/apps';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// Wraps every HRMS page: login required, sidebar + top bar. Chat runs in its own tab (see ChatShell).
export default function AppShell({ children }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => claimTab('hrms'), []);

  return (
    <SessionGate>
      <ChatProvider>
        <CallProvider>
          <div className="min-h-screen">
            <div className="no-print">
              <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>
            <div className="lg:pl-64 print:pl-0">
              <Topbar onMenuClick={() => setSidebarOpen(true)} />
              {/* key on pathname replays the fade-in on every navigation */}
              <main key={pathname} className="page-enter mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
                {children}
              </main>
            </div>
          </div>
        </CallProvider>
      </ChatProvider>
    </SessionGate>
  );
}
