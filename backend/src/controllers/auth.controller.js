import { Settings, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { signToken } from '../utils/token.js';
import { pick } from '../utils/helpers.js';
import { createResetToken, hashToken } from '../utils/password.js';
import { env } from '../config/env.js';
import { sendEmail } from '../services/notification.service.js';
import { buildPersonalDataExport } from '../services/gdpr.service.js';
import { getPolicies } from '../services/policy.service.js';
import { USER_POPULATE } from './employee.controller.js';
import { getAccessRoles, getTeamSize } from '../services/access.service.js';

/*
 * Profile + what the user can do: accessRoles (e.g. ['employee', 'manager'] for a team lead)
 * and team size, so the frontend can show the manager workspace and the direct / all toggle.
 * company.timezone / currency: every screen shows times and money in them.
 */
async function buildSessionUser(userId) {
  const [profile, settings] = await Promise.all([User.findById(userId).populate(USER_POPULATE), Settings.getSettings()]);
  const team = await getTeamSize(profile._id);
  profile.$locals.hasReportees = team.direct > 0;
  return {
    ...profile.toJSON(),
    accessRoles: getAccessRoles(profile),
    team,
    company: {
      name: settings.companyName,
      timezone: settings.timezone,
      currency: settings.currency,
      features: {
        payroll: settings.features?.payroll !== false,
        workStatus: settings.features?.workStatus !== false,
        chat: settings.features?.chat !== false,
      },
      privacyNoticeUrl: settings.privacyNoticeUrl || null,
      policies: { leaveYearStartMonth: getPolicies(settings).leaveYearStartMonth, fitNoteAfterDays: getPolicies(settings).fitNoteAfterDays },
    },
  };
}

// POST /api/auth/login
export async function login(req, res) {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status !== 'active') throw ApiError.unauthorized('Your account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save();

  sendSuccess(res, { data: { token: signToken(user._id), user: await buildSessionUser(user._id) }, message: 'Login successful' });
}

// GET /api/auth/me
export async function getMe(req, res) {
  sendSuccess(res, { data: await buildSessionUser(req.user._id) });
}

// PATCH /api/auth/me - employee updates own personal details
export async function updateMe(req, res) {
  const allowed = pick(req.body, [
    'phone',
    'gender',
    'dateOfBirth',
    'maritalStatus',
    'bloodGroup',
    'avatar',
    'address',
    'emergencyContact',
  ]);

  await User.findByIdAndUpdate(req.user._id, allowed, { runValidators: true });
  sendSuccess(res, { data: await buildSessionUser(req.user._id), message: 'Profile updated' });
}

// PATCH /api/auth/change-password
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) throw ApiError.field('currentPassword', 'Current password is incorrect');

  if (currentPassword === newPassword) throw ApiError.field('newPassword', 'Choose a password different from the current one');

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  // Old sessions are now invalid, so hand back a fresh token for this one
  sendSuccess(res, { data: { token: signToken(user._id), user: await buildSessionUser(user._id) }, message: 'Password changed successfully' });
}

// GET /api/auth/me/export - a copy of all my personal data (UK GDPR subject access request)
export async function exportMyData(req, res) {
  const data = await buildPersonalDataExport(req.user._id);
  res.setHeader('Content-Disposition', `attachment; filename="my-data-${req.user.employeeCode || req.user._id}.json"`);
  sendSuccess(res, { data });
}

const RESET_MINUTES = 60;

/*
 * POST /api/auth/forgot-password { email }
 * Always answers the same way so nobody can find out which emails have accounts.
 */
export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email, status: 'active' });
  if (user) {
    const { token, hash } = createResetToken();
    user.passwordResetToken = hash;
    user.passwordResetExpires = new Date(Date.now() + RESET_MINUTES * 60000);
    await user.save();
    const link = `${env.clientOrigins[0]}/reset-password?token=${token}`;
    await sendEmail(
      user.email,
      'Reset your password',
      `Hi ${user.firstName},\n\nUse this link to set a new password (valid for ${RESET_MINUTES} minutes):\n${link}\n\nIf you did not ask for this, you can ignore this email.`
    );
  }
  sendSuccess(res, { message: 'If an account exists for that email, we have sent a link to reset the password. No email? Ask HR to reset it.' });
}

// POST /api/auth/reset-password { token, newPassword }
export async function resetPasswordWithToken(req, res) {
  const user = await User.findOne({ passwordResetToken: hashToken(req.body.token), passwordResetExpires: { $gt: new Date() } }).select('+passwordResetToken +passwordResetExpires');
  if (!user || user.status !== 'active') throw ApiError.badRequest('This reset link is invalid or has expired. Please ask for a new one.');

  user.password = req.body.newPassword;
  user.mustChangePassword = false;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  sendSuccess(res, { message: 'Password updated. You can now log in.' });
}
