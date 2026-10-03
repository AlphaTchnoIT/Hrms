import { Router } from 'express';
import {
  applyRegularization,
  cancelRegularization,
  checkIn,
  checkOut,
  getDailyAttendance,
  getEmployeeAttendance,
  getMonthlyReport,
  getMyAttendance,
  getMyRegularizations,
  getToday,
  listRegularizations,
  reviewRegularization,
} from '../controllers/attendance.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { punchSchema, regularizationSchema } from '../validators/attendance.validator.js';
import { reviewSchema } from '../validators/common.js';

const router = Router();

// Self service
router.get('/today', getToday);
router.post('/check-in', validate(punchSchema), checkIn);
router.post('/check-out', validate(punchSchema), checkOut);
router.get('/my', getMyAttendance);

// Team / company views
router.get('/daily', authorize(APPROVER_ROLES), getDailyAttendance);
router.get('/report', authorize(APPROVER_ROLES), getMonthlyReport);
router.get('/employee/:id', authorize(APPROVER_ROLES), getEmployeeAttendance);

// Regularization
router.post('/regularizations', validate(regularizationSchema), applyRegularization);
router.get('/regularizations/my', getMyRegularizations);
router.get('/regularizations', authorize(APPROVER_ROLES), listRegularizations);
router.patch('/regularizations/:id/review', authorize(APPROVER_ROLES), validate(reviewSchema), reviewRegularization);
router.patch('/regularizations/:id/cancel', cancelRegularization);

export default router;
