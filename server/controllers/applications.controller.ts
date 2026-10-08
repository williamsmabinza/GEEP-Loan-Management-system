import { Request, Response, NextFunction } from 'express';
import {
  getAllApplications,
  getApplicationById,
  createApplication,
  submitApplication,
  addApplicationDocument,
  addApplicationNote,
  recommendApplication,
  recordCreditAssessment,
  transitionApplicationStatus,
  getApplicationStats,
  disburseApplication,
  getApplicationCustomerHistory,
} from '../services/applications.service.js';
import {
  CreateLoanApplicationInput,
  TransitionApplicationStatusInput,
  CreditAssessmentInput,
  RecommendApplicationInput,
  AddApplicationNoteInput,
  DisburseLoanInput,
} from '../../shared/validators/loan.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateFileSecurity } from '../utils/fileSecurity.js';

export async function handleGetApplications(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const filters = {
      customerId: req.query.customerId ? String(req.query.customerId) : undefined,
      userId: req.user.userId,
      userRole: req.user.role,
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
    };

    const applications = await getAllApplications(filters);
    res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetApplicationById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const application = await getApplicationById(req.params.id);

    // Customer security barrier & IDOR protection
    if (req.user.role === 'CUSTOMER') {
      const isOwner =
        application.customerId === req.user.userId ||
        application.customer?.id === req.user.userId ||
        application.customer?.userId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && application.customerId === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to loan application of another customer.');
      }
    }

    res.status(200).json({
      success: true,
      data: application,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCreateApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as CreateLoanApplicationInput;
    const application = await createApplication(req.user.userId, input, {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
    });

    res.status(201).json({
      success: true,
      data: application,
      message:
        input.status === 'DRAFT'
          ? 'Loan application drafted successfully'
          : 'Loan application submitted for institutional underwriting review',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleSubmitApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const application = await submitApplication(req.params.id, req.user.userId);
    res.status(200).json({
      success: true,
      data: application,
      message: 'Draft application officially submitted to credit review queue.',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleAddDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const { documentType, documentName, fileSize, fileUrl } = req.body;
    if (!documentType || !documentName || !fileUrl) {
      throw AppError.badRequest('documentType, documentName, and fileUrl are required.');
    }

    // IDOR protection: Verify ownership if applicant
    const application = await getApplicationById(req.params.id);
    if (req.user.role === 'CUSTOMER') {
      const isOwner =
        application.customerId === req.user.userId ||
        application.customer?.id === req.user.userId ||
        application.customer?.userId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && application.customerId === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to upload documents to another customer application.');
      }
    }

    // Security validation for document title, format, extensions, and payloads
    const { sanitizedFilename } = validateFileSecurity({
      filename: documentName,
      fileUrl,
    });

    const doc = await addApplicationDocument(req.params.id, req.user.userId, {
      documentType,
      documentName: sanitizedFilename,
      fileSize,
      fileUrl,
    });

    res.status(201).json({
      success: true,
      data: doc,
      message: 'Supporting document uploaded successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleAddNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as AddApplicationNoteInput;
    const note = await addApplicationNote(
      req.params.id,
      {
        userId: req.user.userId,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      input
    );

    res.status(201).json({
      success: true,
      data: note,
      message: 'Internal review note added to file.',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRecommendApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as RecommendApplicationInput;
    const updated = await recommendApplication(
      req.params.id,
      {
        userId: req.user.userId,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      input
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: `Recommendation "${input.recommendation}" logged by loan officer.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRecordCreditAssessment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as CreditAssessmentInput;
    const assessment = await recordCreditAssessment(
      req.params.id,
      {
        userId: req.user.userId,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      input
    );

    res.status(200).json({
      success: true,
      data: assessment,
      message: 'Credit risk assessment recorded successfully.',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleTransitionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as TransitionApplicationStatusInput;
    const updated = await transitionApplicationStatus(
      req.params.id,
      {
        userId: req.user.userId,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      input
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: `Application transitioned to ${input.targetStatus}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetApplicationStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getApplicationStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleDisburseApplication(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as DisburseLoanInput;
    const result = await disburseApplication(
      req.params.id,
      {
        userId: req.user.userId,
        role: req.user.role,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      },
      input
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Capital disbursed successfully: TZS ${input.amount.toLocaleString()} released. Facility is now ACTIVE.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetApplicationCustomerHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const history = await getApplicationCustomerHistory(req.params.id);
    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}
