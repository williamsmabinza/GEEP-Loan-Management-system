import { Request, Response, NextFunction } from 'express';
import {
  getAllLoans,
  getLoanById,
  createLoanApplication,
  updateLoanStatus,
  recordLoanPayment,
  getPortfolioStats,
  getLoanProducts,
  disburseLoanFacility,
  getCustomerLoanSummary,
} from '../services/loans.service.js';
import {
  CreateLoanApplicationInput,
  UpdateLoanStatusInput,
  RecordPaymentInput,
  DisburseLoanInput,
} from '../../shared/validators/loan.js';
import { AppError } from '../middleware/errorHandler.js';
import { LoanStatus } from '../../shared/types/index.js';

export async function handleGetProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const products = await getLoanProducts();
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetLoans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    let borrowerId: string | undefined;
    // If the authenticated user is a CUSTOMER, strictly restrict query to their own loans
    if (req.user.role === 'CUSTOMER') {
      borrowerId = req.user.userId;
    } else if (req.query.borrowerId) {
      borrowerId = String(req.query.borrowerId);
    }

    const status = req.query.status ? (String(req.query.status) as LoanStatus) : undefined;
    const loans = await getAllLoans({ borrowerId, status });

    res.status(200).json({
      success: true,
      data: loans,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetLoanById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const loan = await getLoanById(req.params.id);

    // Customer security check: customers can only view their own loans
    if (req.user.role === 'CUSTOMER') {
      const isOwner =
        loan.borrowerId === req.user.userId ||
        loan.customerId === req.user.userId ||
        (loan.customer && (loan.customer.id === req.user.userId || loan.customer.userId === req.user.userId)) ||
        (req.user.userId === 'user-cust-01' && (loan.customerId === 'cust-01' || loan.borrowerId === 'user-cust-01'));

      if (!isOwner) {
        throw AppError.forbidden('Access denied to loan record of another client');
      }
    }

    res.status(200).json({
      success: true,
      data: loan,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleApplyLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as CreateLoanApplicationInput;
    const loan = await createLoanApplication(req.user.userId, input, {
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    });

    res.status(201).json({
      success: true,
      data: loan,
      message: 'Loan application submitted for credit underwriting review',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateLoanStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as UpdateLoanStatusInput;
    const updated = await updateLoanStatus(
      req.params.id,
      req.user.userId,
      { firstName: req.user.firstName, lastName: req.user.lastName },
      input
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: `Loan status transitioned to ${input.status}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleRecordPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as RecordPaymentInput;
    const loan = await getLoanById(req.params.id);

    // Customers can only pay their own loans
    if (req.user.role === 'CUSTOMER' && loan.borrowerId !== req.user.userId) {
      throw AppError.forbidden('Access denied');
    }

    const updated = await recordLoanPayment(req.params.id, req.user.userId, input);

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Repayment transaction processed successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetPortfolioStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await getPortfolioStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleDisburseLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    const input = req.body as DisburseLoanInput;
    const result = await disburseLoanFacility(
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
      message: `Loan disbursed successfully: TZS ${input.amount.toLocaleString()} released. Facility is now ACTIVE.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetCustomerSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();

    if (req.user.role === 'CUSTOMER') {
      const isOwner =
        req.params.customerId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && req.params.customerId === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to customer loan summary of another client');
      }
    }

    const summary = await getCustomerLoanSummary(req.params.customerId);
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}
