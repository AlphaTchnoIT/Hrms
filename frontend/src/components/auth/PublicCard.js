import Link from 'next/link';
import { Briefcase } from 'lucide-react';

// Centered card for pages shown without logging in (forgot / reset password)
export default function PublicCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md animate-fade-in">
        <Link href="/login" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Briefcase className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold text-slate-900">PeopleHub</span>
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
