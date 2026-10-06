import { Settings, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { signToken } from '../utils/token.js';
import { pick } from '../utils/helpers.js';
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
  return { ...profile.toJSON(), accessRoles: getAccessRoles(profile), team, company: { name: settings.companyName, timezone: settings.timezone, currency: settings.currency } };
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

  user.password = newPassword;
  await user.save();
  sendSuccess(res, { message: 'Password changed successfully' });
}
