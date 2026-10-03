import { Router } from 'express';
import {
  acknowledgeWarning,
  createEscalation,
  createTrigger,
  deleteTrigger,
  getFlags,
  getHistory,
  getMyWarnings,
  issueWarning,
  listEscalations,
  listTriggers,
  listWarnings,
  suggestStage,
  updateEscalation,
  updateTrigger,
  withdrawWarning,
} from '../controllers/relations.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES, HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  escalationSchema,
  triggerSchema,
  updateEscalationSchema,
  warningNoteSchema,
  warningSchema,
} from '../validators/relations.validator.js';

// Escalations, warnings / conduct, warning triggers and history
const router = Router();

router.get('/warnings/my', getMyWarnings);
router.patch('/warnings/:id/acknowledge', validate(warningNoteSchema), acknowledgeWarning);

router.use(authorize(APPROVER_ROLES));
router.get('/escalations', listEscalations);
router.post('/escalations', validate(escalationSchema), createEscalation);
router.patch('/escalations/:id', validate(updateEscalationSchema), updateEscalation);

router.get('/warnings', listWarnings);
router.get('/warnings/suggest-stage', suggestStage);
router.post('/warnings', validate(warningSchema), issueWarning);
router.patch('/warnings/:id/withdraw', validate(warningNoteSchema), withdrawWarning);

router.get('/flags', getFlags);
router.get('/history/:employeeId', getHistory);

router.get('/triggers', listTriggers);
router.post('/triggers', authorize(HR_ROLES), validate(triggerSchema), createTrigger);
router.put('/triggers/:id', authorize(HR_ROLES), validate(triggerSchema), updateTrigger);
router.delete('/triggers/:id', authorize(HR_ROLES), deleteTrigger);

export default router;
