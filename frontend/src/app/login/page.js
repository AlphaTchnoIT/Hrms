'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowRight, Briefcase, CalendarCheck, ShieldCheck, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useForm } from '@/hooks/useForm';
import { loginSchema } from '@/lib/validation';
import { Button, Input } from '@/components/ui';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@hrms.com' },
  { role: 'HR', email: 'hr@hrms.com' },
  { role: 'Manager', email: 'manager@hrms.com' },
  { role: 'Employee', email: 'employee@hrms.com' },
];
const DEMO_PASSWORD = 'Password@123';

const FEATURES = [
  [CalendarCheck, 'One-click web check-in', 'Live attendance, late marks and regularization'],
  [Wallet, 'Payroll in minutes', 'LOP, PF, PT and printable payslips'],
  [ShieldCheck, 'Approvals that flow', 'Leave, expenses and attendance in one inbox'],
];

export default function LoginPage() {
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();
  const form = useForm({ email: '', password: '' }, { schema: loginSchema });

  // Already logged in? Go to dashboard
  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, user, router]);

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    const loggedIn = await login(email, password);
    toast.success(`Welcome back, ${loggedIn.firstName}!`);
    router.replace('/dashboard');
  });

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* Left: branding */}
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-3xl" />

        <div className="relative flex items-center gap-2.5 text-lg font-bold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600">
            <Briefcase className="h-5 w-5" />
          </span>
          PeopleHub
        </div>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">
            The HR platform your team will actually enjoy using.
          </h1>
          <div className="mt-10 space-y-5">
            {FEATURES.map(([Icon, title, text]) => (
              <div key={title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-5 w-5 text-brand-200" />
                </span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="text-sm text-slate-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} PeopleHub HRMS</p>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Briefcase className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold text-slate-900">PeopleHub</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in to your account</h2>
          <p className="mt-1.5 text-sm text-slate-500">Welcome back! Please enter your details.</p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            <Input label="Work email" type="email" autoComplete="email" placeholder="you@company.com" {...form.register('email')} />
            <Input label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" {...form.register('password')} />
            <Button type="submit" size="lg" loading={form.submitting} className="w-full">
              Sign in <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-10">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> Try a demo account <span className="h-px flex-1 bg-slate-200" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => form.reset({ email: account.email, password: DEMO_PASSWORD })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50"
                >
                  <span className="block text-sm font-medium text-slate-800">{account.role}</span>
                  <span className="block truncate text-[11px] text-slate-500">{account.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400">Demo password: {DEMO_PASSWORD}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
