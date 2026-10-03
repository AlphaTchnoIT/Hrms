import { Router } from 'express';
import {
  createHoliday,
  deleteHoliday,
  listHolidays,
  updateHoliday,
} from '../controllers/holiday.controller.js';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from '../controllers/announcement.controller.js';
import { listNotifications, markAllAsRead, markAsRead } from '../controllers/notification.controller.js';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { HR_ROLES, ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { announcementSchema, holidaySchema, settingsSchema } from '../validators/organization.validator.js';

// Small modules: dashboard, holidays, announcements, notifications, settings
const router = Router();

router.get('/dashboard', getDashboard);

router.get('/holidays', listHolidays);
router.post('/holidays', authorize(HR_ROLES), validate(holidaySchema), createHoliday);
router.put('/holidays/:id', authorize(HR_ROLES), validate(holidaySchema), updateHoliday);
router.delete('/holidays/:id', authorize(HR_ROLES), deleteHoliday);

router.get('/announcements', listAnnouncements);
router.post('/announcements', authorize(HR_ROLES), validate(announcementSchema), createAnnouncement);
router.put('/announcements/:id', authorize(HR_ROLES), validate(announcementSchema), updateAnnouncement);
router.delete('/announcements/:id', authorize(HR_ROLES), deleteAnnouncement);

router.get('/notifications', listNotifications);
router.patch('/notifications/read-all', markAllAsRead);
router.patch('/notifications/:id/read', markAsRead);

router.get('/settings', getSettings);
router.put('/settings', authorize(ROLES.ADMIN), validate(settingsSchema), updateSettings);

export default router;
