import { z } from 'zod';
import { email, password } from './common.js';

export const loginSchema = z.object({
  email,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordWithTokenSchema = z.object({
  token: z.string({ required_error: 'Reset link is missing' }).regex(/^[a-f0-9]{64}$/, 'This reset link is invalid'),
  newPassword: password,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword === data.currentPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'New password must be different from the current one' });
    }
    if (data.confirmPassword !== undefined && data.confirmPassword !== data.newPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
    }
  });
