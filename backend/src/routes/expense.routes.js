import { Router } from 'express';
import {
  createExpense,
  deleteExpense,
  getMyExpenses,
  listExpenses,
  reimburseExpense,
  reviewExpense,
} from '../controllers/expense.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES, HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { expenseSchema } from '../validators/workflow.validator.js';
import { reviewSchema } from '../validators/common.js';

const router = Router();

router.get('/my', getMyExpenses);
router.post('/', validate(expenseSchema), createExpense);
router.delete('/:id', deleteExpense);

router.get('/', authorize(APPROVER_ROLES), listExpenses);
router.patch('/:id/review', authorize(APPROVER_ROLES), validate(reviewSchema), reviewExpense);
router.patch('/:id/reimburse', authorize(HR_ROLES), reimburseExpense);

export default router;
