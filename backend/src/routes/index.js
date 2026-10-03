import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import authRoutes from './auth.routes.js';
import employeeRoutes from './employee.routes.js';
import organizationRoutes from './organization.routes.js';
import attendanceRoutes from './attendance.routes.js';
import leaveRoutes from './leave.routes.js';
import payrollRoutes from './payroll.routes.js';
import expenseRoutes from './expense.routes.js';
import goalRoutes from './goal.routes.js';
import assetRoutes from './asset.routes.js';
import commonRoutes from './common.routes.js';

const router = Router();

// Public (login) + its own protected routes
router.use('/auth', authRoutes);

// Everything below requires a logged-in user
router.use(protect);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/payroll', payrollRoutes);
router.use('/expenses', expenseRoutes);
router.use('/goals', goalRoutes);
router.use('/assets', assetRoutes);
router.use('/', organizationRoutes);
router.use('/', commonRoutes);

export default router;
