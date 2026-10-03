import { Router } from 'express';
import {
  assignAsset,
  createAsset,
  deleteAsset,
  getMyAssets,
  listAssets,
  returnAsset,
  updateAsset,
} from '../controllers/asset.controller.js';
import { authorize } from '../middlewares/auth.middleware.js';
import { HR_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import { assetSchema, assignAssetSchema } from '../validators/workflow.validator.js';

const router = Router();

router.get('/my', getMyAssets);

router.use(authorize(HR_ROLES));
router.get('/', listAssets);
router.post('/', validate(assetSchema), createAsset);
router.put('/:id', validate(assetSchema), updateAsset);
router.patch('/:id/assign', validate(assignAssetSchema), assignAsset);
router.patch('/:id/return', returnAsset);
router.delete('/:id', deleteAsset);

export default router;
