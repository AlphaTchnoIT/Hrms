import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { signToken } from '../utils/token.js';
import { pick } from '../utils/helpers.js';
import { USER_POPULATE } from './employee.controller.js';

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

  const profile = await User.findById(user._id).populate(USER_POPULATE);
  sendSuccess(res, { data: { token: signToken(user._id), user: profile }, message: 'Login successful' });
}

// GET /api/auth/me
export async function getMe(req, res) {
  const user = await User.findById(req.user._id).populate(USER_POPULATE);
  sendSuccess(res, { data: user });
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

  const user = await User.findByIdAndUpdate(req.user._id, allowed, { new: true, runValidators: true }).populate(
    USER_POPULATE
  );
  sendSuccess(res, { data: user, message: 'Profile updated' });
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
