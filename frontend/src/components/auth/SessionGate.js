'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ChangePasswordForm from './ChangePasswordForm';
import PublicCard from './PublicCard';

/*
 * Shared by HRMS and Chat: shows children only to a logged-in user.
 * Not logged in -> /login?next=<this page>, so they come back here after signing in.
 */
export default function SessionGate({ children, loadingText = 'Loading your workspace…' }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm text-slate-500">{loadingText}</p>
      </div>
    );
  }

  // Password set by HR (new account or reset): choose your own before using the app
  if (user.mustChangePassword) {
    return (
      <PublicCard title={`Welcome, ${user.firstName}`} subtitle="For your security, please choose your own password before you continue.">
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" /> Use the temporary password from HR as your current password.
        </div>
        <ChangePasswordForm currentLabel="Temporary password" submitLabel="Set my password" />
        <button onClick={logout} className="mt-4 text-sm text-slate-500 hover:text-slate-800">
          Log out
        </button>
      </PublicCard>
    );
  }

  return children;
}
