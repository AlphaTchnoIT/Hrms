import { Router } from 'express';
import {
  createRun,
  deleteRun,
  getMyPayslips,
  getPayslip,
  getRun,
  listRuns,
  markRunPaid,
} from '../controllers/payroll.controller.js';
import { authorize, requireFeature } from '../middlewares/auth.middleware.js';
import { HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { payrollRunSchema } from '../validators/workflow.validator.js';

const router = Router();

router.use(requireFeature('payroll'));

router.get('/my-payslips', getMyPayslips);
router.get('/payslips/:id', getPayslip);

router.get('/runs', authorize(HR_ROLES), listRuns);
router.post('/runs', authorize(HR_ROLES), validate(payrollRunSchema), createRun);
router.get('/runs/:id', authorize(HR_ROLES), getRun);
router.patch('/runs/:id/mark-paid', authorize(HR_ROLES), markRunPaid);
router.delete('/runs/:id', authorize(HR_ROLES), deleteRun);

export default router;
