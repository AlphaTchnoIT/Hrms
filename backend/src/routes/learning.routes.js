import { Router } from 'express';
import {
  assignTraining,
  createProgram,
  createTest,
  getMyLearning,
  getTestForTaking,
  getTestResults,
  getTrainingRecords,
  listAssignments,
  listPrograms,
  listTests,
  submitAttempt,
  triggerReminders,
  updateMyProgress,
  updateProgram,
  updateTest,
} from '../controllers/learning.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { AUDITOR_ROLES, HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  assignTrainingSchema,
  attemptSchema,
  programSchema,
  progressSchema,
  testSchema,
  updateTestSchema,
} from '../validators/learning.validator.js';

// Training plans, knowledge tests, reminders and training records
const router = Router();

router.get('/my', getMyLearning);
router.patch('/assignments/:id/progress', validate(progressSchema), updateMyProgress);
router.get('/tests/:id/take', getTestForTaking);
router.post('/tests/:id/attempts', validate(attemptSchema), submitAttempt);
router.get('/records/:userId', getTrainingRecords);

// Managers, HR and QA create content and assign it
router.get('/programs', authorize(AUDITOR_ROLES), listPrograms);
router.post('/programs', authorize(AUDITOR_ROLES), validate(programSchema), createProgram);
router.put('/programs/:id', authorize(AUDITOR_ROLES), validate(programSchema), updateProgram);
router.get('/assignments', authorize(AUDITOR_ROLES), listAssignments);
router.post('/assignments', authorize(AUDITOR_ROLES), validate(assignTrainingSchema), assignTraining);
router.get('/tests', authorize(AUDITOR_ROLES), listTests);
router.post('/tests', authorize(AUDITOR_ROLES), validate(testSchema), createTest);
router.put('/tests/:id', authorize(AUDITOR_ROLES), validate(updateTestSchema), updateTest);
router.get('/tests/:id/results', authorize(AUDITOR_ROLES), getTestResults);
router.post('/reminders/run', authorize(HR_ROLES), triggerReminders);

export default router;
