import { Router } from 'express';
import {
  handleGetLoans,
  handleGetLoanById,
  handleApplyLoan,
  handleUpdateLoanStatus,
  handleRecordPayment,
  handleGetPortfolioStats,
  handleDisburseLoan,
  handleGetCustomerSummary,
} from '../controllers/loans.controller.js';
import { requireAuth, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  CreateLoanApplicationSchema,
  UpdateLoanStatusSchema,
  RecordPaymentSchema,
  DisburseLoanSchema,
} from '../../shared/validators/loan.js';
import { financialRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Enforce authentication on all loan API routes
router.use(requireAuth);

router.get('/', requirePermission('loan.view'), handleGetLoans);
router.get('/stats', requirePermission('report.view'), handleGetPortfolioStats);
router.get('/customer/:customerId/summary', requirePermission('loan.view'), handleGetCustomerSummary);
router.get('/:id', requirePermission('loan.view'), handleGetLoanById);

router.post('/apply', financialRateLimiter.middleware(), requirePermission('loan.create'), validateBody(CreateLoanApplicationSchema), handleApplyLoan);
router.post(
  '/:id/disburse',
  financialRateLimiter.middleware(),
  requireAnyPermission(['loan.disburse', 'loan.update']),
  validateBody(DisburseLoanSchema),
  handleDisburseLoan
);

router.patch(
  '/:id/status',
  requireAnyPermission(['loan.approve', 'loan.reject', 'loan.update', 'loan.disburse', 'loan.close']),
  validateBody(UpdateLoanStatusSchema),
  handleUpdateLoanStatus
);
router.post('/:id/payments', financialRateLimiter.middleware(), requirePermission('payment.create'), validateBody(RecordPaymentSchema), handleRecordPayment);

export default router;
