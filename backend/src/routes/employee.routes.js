import { Router } from 'express';
import {
  createEmployee,
  deactivateEmployee,
  getDirectory,
  getEmployee,
  getMyTeam,
  listEmployees,
  resetPassword,
  updateEmployee,
} from '../controllers/employee.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { APPROVER_ROLES, HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createEmployeeSchema, resetPasswordSchema, updateEmployeeSchema } from '../validators/employee.validator.js';

const router = Router();

router.get('/directory', getDirectory);
router.get('/team', authorize(APPROVER_ROLES), getMyTeam);

router.get('/', authorize(HR_ROLES), listEmployees);
router.post('/', authorize(HR_ROLES), validate(createEmployeeSchema), createEmployee);

router.get('/:id', getEmployee);
router.put('/:id', authorize(HR_ROLES), validate(updateEmployeeSchema), updateEmployee);
router.patch('/:id/reset-password', authorize(HR_ROLES), validate(resetPasswordSchema), resetPassword);
router.delete('/:id', authorize(HR_ROLES), deactivateEmployee);

export default router;
