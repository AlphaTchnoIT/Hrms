import ChatShell from '@/components/layout/ChatShell';

export const metadata = { title: 'PeopleHub Chat' };

// Chat runs as its own app (no HRMS sidebar), usually in its own browser tab
export default function ChatLayout({ children }) {
  return <ChatShell>{children}</ChatShell>;
}
