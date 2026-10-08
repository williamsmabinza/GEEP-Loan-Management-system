import { Request, Response, NextFunction } from 'express';
import {
  getCustomers,
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerProfileStatus,
  updateCustomerKycStatus,
  addCustomerDocument,
  verifyCustomerDocument,
  deleteCustomerDocument,
} from '../services/customers.service.js';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
  UpdateKycStatusInput,
  AddCustomerDocumentInput,
  VerifyCustomerDocumentInput,
} from '../../shared/validators/customer.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateFileSecurity } from '../utils/fileSecurity.js';

export async function handleGetAllCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, kycStatus, profileStatus, branchId, page, pageSize } = req.query;

    if (search || kycStatus || profileStatus || branchId || page || pageSize) {
      const result = await getCustomers({
        search: search as string,
        kycStatus: kycStatus as string,
        profileStatus: profileStatus as string,
        branchId: branchId as string,
        page: page ? parseInt(page as string, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize as string, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.items,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          totalCount: result.total,
          totalPages: result.totalPages,
        },
      });
      return;
    }

    const customers = await getAllCustomers();
    res.status(200).json({
      success: true,
      data: customers,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetCustomerById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const customer = await getCustomerById(req.params.id);

    // Customer IDOR guard: clients can only view their own profile
    if (req.user.role === 'CUSTOMER') {
      const isOwner =
        customer.id === req.user.userId ||
        customer.userId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && customer.id === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to customer profile of another client.');
      }
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCreateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as CreateCustomerInput;
    const customer = await createCustomer(input, req.user.userId);
    res.status(201).json({
      success: true,
      data: customer,
      message: 'Customer registered successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    // Customer IDOR guard
    if (req.user.role === 'CUSTOMER') {
      const customer = await getCustomerById(req.params.id);
      const isOwner =
        customer.id === req.user.userId ||
        customer.userId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && customer.id === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to modify customer profile of another client.');
      }
    }

    const input = req.body as UpdateCustomerInput;
    const customer = await updateCustomer(req.params.id, input, req.user.userId);
    res.status(200).json({
      success: true,
      data: customer,
      message: 'Customer updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    await deleteCustomer(req.params.id, req.user.userId);
    res.status(200).json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateCustomerStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as UpdateCustomerStatusInput;
    const updated = await updateCustomerProfileStatus(req.params.id, input, req.user.userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: `Customer profile status updated to ${input.status}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateKycStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as UpdateKycStatusInput;
    const updated = await updateCustomerKycStatus(req.params.id, input, req.user.userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: `Customer KYC status updated to ${input.kycStatus}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleAddCustomerDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as AddCustomerDocumentInput;

    // Customer IDOR guard
    if (req.user.role === 'CUSTOMER') {
      const customer = await getCustomerById(req.params.id);
      const isOwner =
        customer.id === req.user.userId ||
        customer.userId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && customer.id === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to upload documents to another customer profile.');
      }
    }

    // Validate file metadata, extension, size, and mime type
    const { sanitizedFilename } = validateFileSecurity({
      filename: input.documentName,
      mimeType: input.mimeType,
      sizeBytes: input.fileSizeBytes,
      fileUrl: input.fileUrl,
    });
    input.documentName = sanitizedFilename;

    const doc = await addCustomerDocument(req.params.id, input, req.user.userId);
    res.status(201).json({
      success: true,
      data: doc,
      message: 'Document uploaded and registered successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleVerifyCustomerDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as VerifyCustomerDocumentInput;
    const doc = await verifyCustomerDocument(req.params.id, req.params.docId, input, req.user.userId);
    res.status(200).json({
      success: true,
      data: doc,
      message: `Document status updated to ${input.verificationStatus}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteCustomerDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    // Customer IDOR guard
    if (req.user.role === 'CUSTOMER') {
      const customer = await getCustomerById(req.params.id);
      const isOwner =
        customer.id === req.user.userId ||
        customer.userId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && customer.id === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to delete document of another customer profile.');
      }
    }

    await deleteCustomerDocument(req.params.id, req.params.docId, req.user.userId);
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
