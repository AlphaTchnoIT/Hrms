'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { z } from 'zod';
import api from '@/lib/api';
import { useForm } from '@/hooks/useForm';
import { passwordRule } from '@/lib/validation';
import { Button, Input } from '@/components/ui';
import PublicCard from '@/components/auth/PublicCard';

const schema = z
  .object({ newPassword: passwordRule, confirmPassword: z.string().min(1, 'Please confirm the new password') })
  .refine((d) => d.newPassword === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

// Opened from the emailed link: /reset-password?token=...
export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState(undefined);
  const form = useForm({ newPassword: '', confirmPassword: '' }, { schema });

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const onSubmit = form.handleSubmit(async ({ newPassword }) => {
    const res = await api.post('/auth/reset-password', { token, newPassword });
    toast.success(res.message);
    router.replace('/login');
  });

  if (token === undefined) return null;

  return (
    <PublicCard title="Set a new password" subtitle="Use at least 8 characters with a letter and a number.">
      {token ? (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Input label="New password" type="password" autoComplete="new-password" {...form.register('newPassword')} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          <Button type="submit" loading={form.submitting} className="w-full">
            Save password
          </Button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">
          This link is incomplete.{' '}
          <Link href="/forgot-password" className="font-medium text-brand-600 hover:underline">
            Ask for a new one
          </Link>
          .
        </p>
      )}
    </PublicCard>
  );
}
