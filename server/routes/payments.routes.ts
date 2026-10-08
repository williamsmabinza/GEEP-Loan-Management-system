import { Router } from 'express';
import {
  handleGetAllPayments,
  handleGetPaymentById,
  handleGetPaymentReceipt,
  handlePreviewAllocation,
  handleCreatePayment,
  handleReversePayment,
} from '../controllers/payments.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { CreatePaymentSchema, ReversePaymentSchema } from '../../shared/validators/payment.js';
import { financialRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('payment.view'), handleGetAllPayments);
router.post('/preview-allocation', requirePermission('payment.view'), handlePreviewAllocation);
router.get('/:id/receipt', requirePermission('payment.view'), handleGetPaymentReceipt);
router.get('/:id', requirePermission('payment.view'), handleGetPaymentById);
router.post('/', financialRateLimiter.middleware(), requirePermission('payment.create'), validateBody(CreatePaymentSchema), handleCreatePayment);
router.post('/:id/reverse', financialRateLimiter.middleware(), requirePermission('payment.reverse'), validateBody(ReversePaymentSchema), handleReversePayment);

export default router;
