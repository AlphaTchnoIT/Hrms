import { User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../utils/token.js';

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

  req.user = user;
  next();
}

// Allow only the given roles. Usage: authorize('admin', 'hr')
export function authorize(...roles) {
  const allowed = roles.flat();
  return (req, _res, next) => {
    if (!allowed.includes(req.user.role)) throw ApiError.forbidden();
    next();
  };
}
