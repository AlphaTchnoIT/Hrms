import { Router } from 'express';
import { createGoal, deleteGoal, getMyGoals, listGoals, updateGoal } from '../controllers/goal.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { goalSchema } from '../validators/workflow.validator.js';

const router = Router();

router.get('/my', getMyGoals);
router.get('/', authorize(APPROVER_ROLES), listGoals);
router.post('/', validate(goalSchema), createGoal);
router.put('/:id', validate(goalSchema), updateGoal);
router.delete('/:id', deleteGoal);

export default router;
