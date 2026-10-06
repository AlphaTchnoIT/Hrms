import { Settings, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../utils/token.js';
import { ROLES } from '../constants/index.js';
import { hasActiveReportees, isHR, isManager } from '../services/access.service.js';

function isPasswordChangeRoute(req) {
  const path = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  return (req.method === 'GET' && path.endsWith('/auth/me')) || (req.method === 'PATCH' && path.endsWith('/auth/change-password'));
}

// Verifies the JWT from "Authorization: Bearer <token>" and attaches the user to req.user
export async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) throw ApiError.unauthorized('Please login to continue');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired, please login again');
  }

  const user = await User.findById(payload.id);
  if (!user || user.status !== 'active') {
    throw ApiError.unauthorized('Your account is not active');
  }
  // Logged in before the password was changed / reset -> that session is no longer valid
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
    throw ApiError.unauthorized('Your password was changed, please login again');
  }
  // First login with a password set by HR: only reading the profile and changing the password are allowed
  if (user.mustChangePassword && !isPasswordChangeRoute(req)) {
    throw new ApiError(403, 'Please set a new password to continue', { code: 'PASSWORD_CHANGE_REQUIRED' });
  }

  // Team leads without the manager role still manage the people who report to them
  if (!isHR(user) && user.role !== ROLES.MANAGER) user.$locals.hasReportees = await hasActiveReportees(user._id);

  req.user = user;
  next();
}

// Allow only the given roles. Usage: authorize('admin', 'hr')
// 'manager' also lets in anyone with reportees (team leads), see isManager()
export function authorize(...roles) {
  const allowed = roles.flat();
  return (req, _res, next) => {
    const asManager = allowed.includes(ROLES.MANAGER) && isManager(req.user);
    if (!allowed.includes(req.user.role) && !asManager) throw ApiError.forbidden();
    next();
  };
}

// Blocks a module the company switched off in Settings -> Modules (e.g. payroll run elsewhere)
export function requireFeature(feature) {
  return async (_req, _res, next) => {
    const settings = await Settings.getSettings();
    if (settings.features?.[feature] === false) throw ApiError.forbidden('This module is switched off for your company');
    next();
  };
}
