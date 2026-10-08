'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { z } from 'zod';
import api from '@/lib/api';
import { useForm } from '@/hooks/useForm';
import { Button, Input } from '@/components/ui';
import PublicCard from '@/components/auth/PublicCard';

const schema = z.object({ email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address') });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(null);
  const form = useForm({ email: '' }, { schema });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    const res = await api.post('/auth/forgot-password', { email });
    setSent(res.message);
  });

  return (
    <PublicCard title="Forgot your password?" subtitle="Enter your work email and we will send you a link to set a new one.">
      {sent ? (
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-sm text-slate-600">{sent}</p>
          <Link href="/login" className="inline-block text-sm font-medium text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
          <Input label="Work email" type="email" autoComplete="email" placeholder="you@company.co.uk" {...form.register('email')} />
          <Button type="submit" loading={form.submitting} className="w-full">
            Send reset link
          </Button>
          <p className="text-center text-sm">
            <Link href="/login" className="font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </PublicCard>
  );
}
