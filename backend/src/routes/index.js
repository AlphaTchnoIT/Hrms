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
import workforceRoutes from './workforce.routes.js';
import performanceRoutes from './performance.routes.js';
import actionPlanRoutes from './actionPlan.routes.js';
import qualityRoutes from './quality.routes.js';
import relationsRoutes from './relations.routes.js';
import reportRoutes from './report.routes.js';
import recruitmentRoutes, { careersRouter } from './recruitment.routes.js';
import learningRoutes from './learning.routes.js';
import supportRoutes from './support.routes.js';
import publicRoutes from './public.routes.js';
import workStatusRoutes from './workStatus.routes.js';
import complianceRoutes from './compliance.routes.js';

const router = Router();

// Public (login) + its own protected routes
router.use('/auth', authRoutes);
router.use('/public', publicRoutes); // candidate application status (no login)

// Everything below requires a logged-in user
router.use(protect);
router.use('/employees', employeeRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/leaves', leaveRoutes);
router.use('/payroll', payrollRoutes);
router.use('/expenses', expenseRoutes);
router.use('/goals', goalRoutes);
router.use('/assets', assetRoutes);
router.use('/workforce', workforceRoutes);
router.use('/performance', performanceRoutes);
router.use('/action-plans', actionPlanRoutes);
router.use('/quality', qualityRoutes);
router.use('/relations', relationsRoutes);
router.use('/recruitment', recruitmentRoutes);
router.use('/careers', careersRouter);
router.use('/learning', learningRoutes);
router.use('/support', supportRoutes);
router.use('/work-status', workStatusRoutes);
router.use('/compliance', complianceRoutes);
router.use('/', reportRoutes);
router.use('/', organizationRoutes);
router.use('/', commonRoutes);

export default router;
