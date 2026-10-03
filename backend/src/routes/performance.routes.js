import { Router } from 'express';
import {
  acknowledgeRating,
  approveRating,
  bulkUpsertKpis,
  deleteKpi,
  generateRatings,
  getEmployeePerformance,
  getMyPerformance,
  getMyRatings,
  getTeamPerformance,
  listKpis,
  listManagerRatings,
  listRatings,
  updateRating,
  upsertKpi,
} from '../controllers/performance.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES, AUDITOR_ROLES, ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  approveRatingSchema,
  bulkKpiSchema,
  generateRatingsSchema,
  kpiSchema,
  updateRatingSchema,
} from '../validators/performance.validator.js';

// KPI dashboard, KPI results, team performance, manager rating, monthly rating approvals
const router = Router();

router.get('/my', getMyPerformance);
router.get('/ratings/my', getMyRatings);
router.patch('/ratings/:id/acknowledge', acknowledgeRating);

router.get('/employee/:id', authorize(AUDITOR_ROLES), getEmployeePerformance);
router.get('/team', authorize(APPROVER_ROLES), getTeamPerformance);
router.get('/manager-ratings', authorize(APPROVER_ROLES), listManagerRatings);

router.get('/kpis', authorize(AUDITOR_ROLES), listKpis);
router.post('/kpis', authorize(AUDITOR_ROLES), validate(kpiSchema), upsertKpi);
router.post('/kpis/bulk', authorize(AUDITOR_ROLES), validate(bulkKpiSchema), bulkUpsertKpis);
router.delete('/kpis/:id', authorize(AUDITOR_ROLES), deleteKpi);

router.get('/ratings', authorize(AUDITOR_ROLES), listRatings);
router.post('/ratings/generate', authorize(APPROVER_ROLES), validate(generateRatingsSchema), generateRatings);
router.patch('/ratings/:id', authorize(APPROVER_ROLES), validate(updateRatingSchema), updateRating);
router.patch('/ratings/:id/approve', authorize(ROLES.ADMIN, ROLES.HR, ROLES.QA), validate(approveRatingSchema), approveRating);

export default router;
