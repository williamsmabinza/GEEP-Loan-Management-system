import { Router } from 'express';
import {
  handleGetAllProducts,
  handleGetProductById,
  handleCreateProduct,
  handleUpdateProduct,
  handleToggleProductStatus,
  handleDeleteProduct,
  handleCalculateLoan,
} from '../controllers/products.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  CreateLoanProductSchema,
  UpdateLoanProductSchema,
  ToggleProductStatusSchema,
  CalculateLoanSchema,
} from '../../shared/validators/product.js';

const router = Router();

// Public / Authenticated read & calculator routes
router.get('/', handleGetAllProducts);
router.post('/calculate', validateBody(CalculateLoanSchema), handleCalculateLoan);
router.get('/:id', handleGetProductById);

// Protected Admin / Management CRUD routes
router.post(
  '/',
  requireAuth,
  requirePermission('settings.update'),
  validateBody(CreateLoanProductSchema),
  handleCreateProduct
);

router.put(
  '/:id',
  requireAuth,
  requirePermission('settings.update'),
  validateBody(UpdateLoanProductSchema),
  handleUpdateProduct
);

router.patch(
  '/:id/status',
  requireAuth,
  requirePermission('settings.update'),
  validateBody(ToggleProductStatusSchema),
  handleToggleProductStatus
);

router.delete(
  '/:id',
  requireAuth,
  requirePermission('settings.update'),
  handleDeleteProduct
);

export default router;
