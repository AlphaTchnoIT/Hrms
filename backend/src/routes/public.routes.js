import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getPublicStatus, submitPublicDocument } from '../controllers/recruitment.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { submitDocumentSchema } from '../validators/recruitment.validator.js';

// No login: external candidates check their application with reference number + email
const router = Router();

const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, message: { success: false, message: 'Too many requests, try again later' } });
router.use(publicLimiter);

router.get('/application-status', getPublicStatus);
router.post('/applications/:ref/documents/:docId', validate(submitDocumentSchema), submitPublicDocument);

export default router;
