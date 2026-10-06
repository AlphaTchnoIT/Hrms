import { Router } from 'express';
import { getDayTimeline, getMyStatus, getPresence, getStatusOptions, getTeamStatus, setMyStatus } from '../controllers/workStatus.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { APPROVER_ROLES } from '../constants/index.js';
import { setStatusSchema } from '../validators/workStatus.validator.js';

const router = Router();

router.get('/options', getStatusOptions);
router.get('/me', getMyStatus);
router.post('/', validate(setStatusSchema), setMyStatus);
router.get('/presence', getPresence);
router.get('/day', getDayTimeline); // self, or someone in the user's team (checked in the controller)
router.get('/team', authorize(APPROVER_ROLES), getTeamStatus);

export default router;
