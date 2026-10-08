import { Router } from 'express';
import {
  handleGetSettings,
  handleUpdateSettings,
  handleGetWorkflowSettings,
  handleUpdateWorkflowSettings,
} from '../controllers/settings.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BulkUpdateSettingsSchema } from '../../shared/validators/settings.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('settings.view'), handleGetSettings);
router.put('/', requirePermission('settings.update'), validateBody(BulkUpdateSettingsSchema), handleUpdateSettings);

router.get('/workflow', requirePermission('settings.view'), handleGetWorkflowSettings);
router.put('/workflow', requirePermission('settings.update'), handleUpdateWorkflowSettings);

export default router;
