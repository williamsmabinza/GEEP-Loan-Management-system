import { Router } from 'express';
import {
  handleGetApplications,
  handleGetApplicationById,
  handleCreateApplication,
  handleSubmitApplication,
  handleAddDocument,
  handleAddNote,
  handleRecommendApplication,
  handleRecordCreditAssessment,
  handleTransitionStatus,
  handleGetApplicationStats,
  handleDisburseApplication,
  handleGetApplicationCustomerHistory,
} from '../controllers/applications.controller.js';
import { requireAuth, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  CreateLoanApplicationSchema,
  AddApplicationNoteSchema,
  RecommendApplicationSchema,
  CreditAssessmentSchema,
  TransitionApplicationStatusSchema,
  DisburseLoanSchema,
} from '../../shared/validators/loan.js';

const router = Router();

// Enforce authentication on all routes
router.use(requireAuth);

router.get('/', requirePermission('loan.view'), handleGetApplications);
router.get('/stats', requirePermission('loan.view'), handleGetApplicationStats);
router.get('/:id', requirePermission('loan.view'), handleGetApplicationById);
router.get('/:id/customer-history', requirePermission('loan.view'), handleGetApplicationCustomerHistory);

router.post('/', requirePermission('loan.create'), validateBody(CreateLoanApplicationSchema), handleCreateApplication);
router.post('/:id/submit', requirePermission('loan.create'), handleSubmitApplication);
router.post('/:id/documents', requireAnyPermission(['loan.create', 'loan.update']), handleAddDocument);
router.post('/:id/notes', requireAnyPermission(['loan.review', 'loan.update', 'loan.assess']), validateBody(AddApplicationNoteSchema), handleAddNote);
router.post('/:id/recommend', requireAnyPermission(['loan.recommend', 'loan.review']), validateBody(RecommendApplicationSchema), handleRecommendApplication);
router.post('/:id/assess', requireAnyPermission(['loan.assess', 'loan.approve']), validateBody(CreditAssessmentSchema), handleRecordCreditAssessment);
router.post(
  '/:id/disburse',
  requireAnyPermission(['loan.disburse', 'loan.update']),
  validateBody(DisburseLoanSchema),
  handleDisburseApplication
);

router.patch(
  '/:id/status',
  requireAnyPermission(['loan.review', 'loan.recommend', 'loan.assess', 'loan.approve', 'loan.reject', 'loan.disburse', 'loan.update', 'loan.close']),
  validateBody(TransitionApplicationStatusSchema),
  handleTransitionStatus
);

export default router;
