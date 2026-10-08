import { Router } from 'express';
import { handleGetAuditLogs } from '../controllers/audit.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';

const router = Router();

// Enforce audit.view permission
router.get('/', requireAuth, requirePermission('audit.view'), handleGetAuditLogs);

export default router;
