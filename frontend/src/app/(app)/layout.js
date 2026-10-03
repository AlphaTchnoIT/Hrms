import AppShell from '@/components/layout/AppShell';

// Every page inside the (app) folder is protected and gets the sidebar + topbar
export default function ProtectedLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
