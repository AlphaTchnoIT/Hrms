import { Router } from 'express';
import {
  createDepartment,
  deleteDepartment,
  listDepartments,
  updateDepartment,
} from '../controllers/department.controller.js';
import {
  createDesignation,
  deleteDesignation,
  listDesignations,
  updateDesignation,
} from '../controllers/designation.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { departmentSchema, designationSchema } from '../validators/organization.validator.js';

// Departments and designations
const router = Router();

router.get('/departments', listDepartments);
router.post('/departments', authorize(HR_ROLES), validate(departmentSchema), createDepartment);
router.put('/departments/:id', authorize(HR_ROLES), validate(departmentSchema), updateDepartment);
router.delete('/departments/:id', authorize(HR_ROLES), deleteDepartment);

router.get('/designations', listDesignations);
router.post('/designations', authorize(HR_ROLES), validate(designationSchema), createDesignation);
router.put('/designations/:id', authorize(HR_ROLES), validate(designationSchema), updateDesignation);
router.delete('/designations/:id', authorize(HR_ROLES), deleteDesignation);

export default router;
