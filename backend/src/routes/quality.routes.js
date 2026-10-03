import { Router } from 'express';
import {
  acknowledgeFeedback,
  createFeedback,
  createInteraction,
  deleteFeedback,
  getCalibrationSummary,
  getMyFeedback,
  getRepeatedErrors,
  listCalibrations,
  listFeedback,
  listInteractions,
  selectCalibration,
  signOffCalibration,
  submitCalibrationAudit,
} from '../controllers/quality.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { AUDITOR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  acknowledgeFeedbackSchema,
  calibrationAuditSchema,
  calibrationSignOffSchema,
  interactionSchema,
  qaFeedbackSchema,
  selectCalibrationSchema,
} from '../validators/quality.validator.js';

// QA feedback & acknowledgement, interactions and calibration
const router = Router();

router.get('/feedback/my', getMyFeedback);
router.patch('/feedback/:id/acknowledge', validate(acknowledgeFeedbackSchema), acknowledgeFeedback);

router.use(authorize(AUDITOR_ROLES));
router.get('/feedback', listFeedback);
router.post('/feedback', validate(qaFeedbackSchema), createFeedback);
router.delete('/feedback/:id', deleteFeedback);
router.get('/repeated-errors', getRepeatedErrors);

router.get('/interactions', listInteractions);
router.post('/interactions', validate(interactionSchema), createInteraction);

router.get('/calibrations', listCalibrations);
router.get('/calibrations/summary', getCalibrationSummary);
router.post('/calibrations/select', validate(selectCalibrationSchema), selectCalibration);
router.post('/calibrations/:id/audit', validate(calibrationAuditSchema), submitCalibrationAudit);
router.post('/calibrations/:id/sign-off', validate(calibrationSignOffSchema), signOffCalibration);

export default router;
