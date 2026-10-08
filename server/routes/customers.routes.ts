import { Router } from 'express';
import {
  handleGetAllCustomers,
  handleGetCustomerById,
  handleCreateCustomer,
  handleUpdateCustomer,
  handleDeleteCustomer,
  handleUpdateCustomerStatus,
  handleUpdateKycStatus,
  handleAddCustomerDocument,
  handleVerifyCustomerDocument,
  handleDeleteCustomerDocument,
} from '../controllers/customers.controller.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
  UpdateCustomerStatusSchema,
  UpdateKycStatusSchema,
  AddCustomerDocumentSchema,
  VerifyCustomerDocumentSchema,
} from '../../shared/validators/customer.js';

const router = Router();

// Protect all customer routes with authentication
router.use(requireAuth);

router.get('/', requirePermission('customer.view'), handleGetAllCustomers);
router.get('/:id', requirePermission('customer.view'), handleGetCustomerById);
router.post('/', requirePermission('customer.create'), validateBody(CreateCustomerSchema), handleCreateCustomer);
router.put('/:id', requirePermission('customer.update'), validateBody(UpdateCustomerSchema), handleUpdateCustomer);
router.delete('/:id', requirePermission('customer.delete'), handleDeleteCustomer);

// Status and KYC management
router.patch('/:id/status', requirePermission('customer.update'), validateBody(UpdateCustomerStatusSchema), handleUpdateCustomerStatus);
router.patch('/:id/kyc', requirePermission('customer.update'), validateBody(UpdateKycStatusSchema), handleUpdateKycStatus);

// Document management
router.post('/:id/documents', requirePermission('customer.update'), validateBody(AddCustomerDocumentSchema), handleAddCustomerDocument);
router.patch('/:id/documents/:docId/verify', requirePermission('customer.update'), validateBody(VerifyCustomerDocumentSchema), handleVerifyCustomerDocument);
router.delete('/:id/documents/:docId', requirePermission('customer.delete'), handleDeleteCustomerDocument);

export default router;
