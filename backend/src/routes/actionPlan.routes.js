import { Router } from 'express';
import {
  acknowledgePlan,
  addCheckIn,
  createPlan,
  getMyPlans,
  getPlan,
  listPlans,
  suggestPlans,
  toggleAction,
  updatePlan,
} from '../controllers/actionPlan.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  acknowledgeSchema,
  actionPlanSchema,
  checkInSchema,
  suggestPlanSchema,
  toggleActionSchema,
  updateActionPlanSchema,
} from '../validators/performance.validator.js';

const router = Router();

router.get('/my', getMyPlans);
router.get('/', authorize(APPROVER_ROLES), listPlans);
router.post('/suggest', authorize(APPROVER_ROLES), validate(suggestPlanSchema), suggestPlans);
router.post('/', authorize(APPROVER_ROLES), validate(actionPlanSchema), createPlan);
router.get('/:id', getPlan);
router.put('/:id', authorize(APPROVER_ROLES), validate(updateActionPlanSchema), updatePlan);
router.post('/:id/check-ins', authorize(APPROVER_ROLES), validate(checkInSchema), addCheckIn);
router.patch('/:id/actions/:actionId', validate(toggleActionSchema), toggleAction);
router.patch('/:id/acknowledge', validate(acknowledgeSchema), acknowledgePlan);

export default router;
