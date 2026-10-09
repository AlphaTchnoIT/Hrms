import { Router } from 'express';
import {
  assignRoster,
  clearRoster,
  getLoginHours,
  getMonthlyHours,
  getMyAttendanceStatus,
  getMyRoster,
  getTeamRoster,
  getTrends,
  updateLoginHours,
  updateMonthlyHours,
} from '../controllers/workforce.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { clearRosterSchema, loginHoursSchema, monthlyHoursSchema, rosterSchema } from '../validators/workforce.validator.js';

// Roster & shift schedule, attendance tracking, login / AT hours, adherence trends
const router = Router();

router.get('/roster/my', getMyRoster);
router.get('/attendance/my', getMyAttendanceStatus);
router.get('/trends', getTrends);

router.get('/roster', authorize(APPROVER_ROLES), getTeamRoster);
router.post('/roster/bulk', authorize(APPROVER_ROLES), validate(rosterSchema), assignRoster);
router.post('/roster/clear', authorize(APPROVER_ROLES), validate(clearRosterSchema), clearRoster);
router.get('/login-hours', authorize(APPROVER_ROLES), getLoginHours);
router.put('/login-hours', authorize(APPROVER_ROLES), validate(loginHoursSchema), updateLoginHours);
router.get('/monthly-hours', authorize(APPROVER_ROLES), getMonthlyHours);
router.put('/monthly-hours', authorize(APPROVER_ROLES), validate(monthlyHoursSchema), updateMonthlyHours);

export default router;
