import { Router } from 'express';
import {
  applyLeave,
  cancelLeave,
  createLeaveType,
  deleteLeaveType,
  getEmployeeBalances,
  getMyBalances,
  getMyLeaves,
  getWhoIsOut,
  listLeaves,
  listLeaveTypes,
  reviewLeave,
  updateEmployeeBalance,
  updateLeaveType,
} from '../controllers/leave.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES, HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { applyLeaveSchema, leaveBalanceSchema, leaveTypeSchema } from '../validators/leave.validator.js';
import { reviewSchema } from '../validators/common.js';

const router = Router();

// Leave types
router.get('/types', listLeaveTypes);
router.post('/types', authorize(HR_ROLES), validate(leaveTypeSchema), createLeaveType);
router.put('/types/:id', authorize(HR_ROLES), validate(leaveTypeSchema), updateLeaveType);
router.delete('/types/:id', authorize(HR_ROLES), deleteLeaveType);

// Balances
router.get('/balances', getMyBalances);
router.get('/balances/:userId', authorize(APPROVER_ROLES), getEmployeeBalances);
router.put('/balances/:userId', authorize(HR_ROLES), validate(leaveBalanceSchema), updateEmployeeBalance);

// Requests
router.get('/my', getMyLeaves);
router.get('/who-is-out', getWhoIsOut);
router.post('/', validate(applyLeaveSchema), applyLeave);
router.get('/', authorize(APPROVER_ROLES), listLeaves);
router.patch('/:id/review', authorize(APPROVER_ROLES), validate(reviewSchema), reviewLeave);
router.patch('/:id/cancel', cancelLeave);

export default router;
