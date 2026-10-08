'use client';

import toast from 'react-hot-toast';
import api, { tokenStorage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useForm } from '@/hooks/useForm';
import { changePasswordSchema } from '@/lib/validation';
import { Button, Input } from '@/components/ui';

/*
 * Change password. The server ends all other sessions and returns a fresh token for this one,
 * so it is saved straight away.
 */
export default function ChangePasswordForm({ submitLabel = 'Update password', currentLabel = 'Current password' }) {
  const { setUser } = useAuth();
  const empty = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const form = useForm(empty, { schema: changePasswordSchema });

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.patch('/auth/change-password', data);
    if (res.data?.token) tokenStorage.set(res.data.token);
    if (res.data?.user) setUser(res.data.user);
    toast.success(res.message);
    form.reset(empty);
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="space-y-4">
      <Input label={currentLabel} type="password" autoComplete="current-password" required {...form.register('currentPassword')} />
      <Input label="New password" type="password" autoComplete="new-password" required hint="At least 8 characters with a letter and a number" {...form.register('newPassword')} />
      <Input label="Confirm new password" type="password" autoComplete="new-password" required {...form.register('confirmPassword')} />
      <Button type="submit" loading={form.submitting} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}
