import { Router } from 'express';
import { createComplianceItem, deleteComplianceItem, listCompliance, updateComplianceItem } from '../controllers/compliance.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { HR_ROLES } from '../constants/index.js';
import { complianceItemSchema } from '../validators/compliance.validator.js';

// UK compliance checklist (admin / HR)
const router = Router();

router.use(authorize(HR_ROLES));
router.get('/', listCompliance);
router.post('/', validate(complianceItemSchema), createComplianceItem);
router.put('/:id', validate(complianceItemSchema.partial()), updateComplianceItem);
router.delete('/:id', deleteComplianceItem);

export default router;
