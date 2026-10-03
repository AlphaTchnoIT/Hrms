import { Router } from 'express';
import {
  applyInternal,
  createApplication,
  createJob,
  getApplication,
  getMyApplications,
  getMyPanelInterviews,
  listApplications,
  listInternalJobs,
  listJobs,
  requestDocuments,
  reviewDocument,
  scheduleInterview,
  submitMyDocument,
  submitPanelFeedback,
  updateApplicationStatus,
  updateInterview,
  updateJob,
} from '../controllers/recruitment.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  applicationStatusSchema,
  applyInternalSchema,
  candidateSchema,
  interviewResultSchema,
  interviewSchema,
  jobSchema,
  requestDocumentsSchema,
  reviewDocumentSchema,
  submitDocumentSchema,
} from '../validators/recruitment.validator.js';

// Employees: internal job posting, my applications, interview panels
export const careersRouter = Router();
careersRouter.get('/jobs', listInternalJobs);
careersRouter.post('/jobs/:id/apply', validate(applyInternalSchema), applyInternal);
careersRouter.get('/applications', getMyApplications);
careersRouter.patch('/applications/:id/documents/:docId', validate(submitDocumentSchema), submitMyDocument);
careersRouter.get('/interviews', getMyPanelInterviews);
careersRouter.patch('/interviews/:id/:interviewId', validate(interviewResultSchema), submitPanelFeedback);

// HR: applicant tracking system
const router = Router();
router.use(authorize(HR_ROLES));
router.get('/jobs', listJobs);
router.post('/jobs', validate(jobSchema), createJob);
router.put('/jobs/:id', validate(jobSchema), updateJob);
router.get('/applications', listApplications);
router.post('/applications', validate(candidateSchema), createApplication);
router.get('/applications/:id', getApplication);
router.patch('/applications/:id/status', validate(applicationStatusSchema), updateApplicationStatus);
router.post('/applications/:id/interviews', validate(interviewSchema), scheduleInterview);
router.patch('/applications/:id/interviews/:interviewId', validate(interviewResultSchema), updateInterview);
router.post('/applications/:id/documents', validate(requestDocumentsSchema), requestDocuments);
router.patch('/applications/:id/documents/:docId', validate(reviewDocumentSchema), reviewDocument);

export default router;
