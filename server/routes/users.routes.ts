import { Router } from 'express';
import {
  handleGetAllUsers,
  handleUpdateUserStatus,
  handleCreateUserByAdmin,
  handleUpdateUserByAdmin,
} from '../controllers/auth.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { UpdateUserStatusSchema, CreateUserByAdminSchema } from '../../shared/validators/auth.js';

const router = Router();

// Protect all user management routes
router.use(requireAuth);

router.get('/', requirePermission('user.view'), handleGetAllUsers);
router.post('/', requirePermission('user.create'), validateBody(CreateUserByAdminSchema), handleCreateUserByAdmin);
router.put('/:id', requirePermission('user.update'), handleUpdateUserByAdmin);
router.patch('/:id/status', requirePermission('user.disable'), validateBody(UpdateUserStatusSchema), handleUpdateUserStatus);

export default router;

