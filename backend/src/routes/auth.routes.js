import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePassword, getMe, login, updateMe } from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { changePasswordSchema, loginSchema } from '../validators/auth.validator.js';
import { personalInfoSchema } from '../validators/employee.validator.js';

const router = Router();

// Max 20 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { success: false, message: 'Too many login attempts, try again later' } });

router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', protect, getMe);
router.patch('/me', protect, validate(personalInfoSchema), updateMe);
router.patch('/change-password', protect, validate(changePasswordSchema), changePassword);

export default router;
