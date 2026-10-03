import { Router } from 'express';
import { getManagementDashboard, listReports, runReport } from '../controllers/report.controller.js';
import { getTeamWorkspace } from '../controllers/workspace.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES, HR_ROLES, ROLES } from '../constants/index.js';

// Reports centre, management dashboard and manager workspace
const router = Router();
const REPORT_ROLES = [...APPROVER_ROLES, ROLES.QA, ROLES.IT];

router.get('/workspace/team', authorize(APPROVER_ROLES), getTeamWorkspace);

router.get('/reports', authorize(REPORT_ROLES), listReports);
router.get('/reports/management', authorize(HR_ROLES), getManagementDashboard);
router.get('/reports/:type', authorize(REPORT_ROLES), runReport);

export default router;
