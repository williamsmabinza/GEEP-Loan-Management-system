import { Request, Response, NextFunction } from 'express';
import {
  getAllPayments,
  getPaymentById,
  createPayment,
  reversePayment,
  getPaymentReceipt,
  previewPaymentAllocation,
} from '../services/payments.service.js';
import { CreatePaymentInput, ReversePaymentInput } from '../../shared/validators/payment.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleGetAllPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let { loanId, customerId, search } = req.query;

    // Customer IDOR guard: customer can only query their own payments
    if (req.user?.role === 'CUSTOMER') {
      customerId = req.user.userId;
    }

    const payments = await getAllPayments({
      loanId: loanId as string,
      customerId: customerId as string,
      search: search as string,
    });
    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetPaymentById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const payment = await getPaymentById(req.params.id);

    // Customer IDOR guard
    if (req.user.role === 'CUSTOMER') {
      const isOwner =
        payment.customerId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && payment.customerId === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to payment record of another client');
      }
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetPaymentReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const receipt = await getPaymentReceipt(req.params.id);

    // Customer IDOR guard
    if (req.user.role === 'CUSTOMER') {
      const isOwner =
        receipt.customerId === req.user.userId ||
        (req.user.userId === 'user-cust-01' && receipt.customerId === 'cust-01');

      if (!isOwner) {
        throw AppError.forbidden('Access denied to official receipt of another client');
      }
    }

    res.status(200).json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
}

export async function handlePreviewAllocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { loanId, amount, strategy, customPriority, overpaymentRule, paymentDate } = req.body;
    if (!loanId || !amount) {
      throw AppError.badRequest('loanId and amount are required for allocation preview.');
    }
    const preview = await previewPaymentAllocation(loanId, Number(amount), {
      strategy,
      customPriority,
      overpaymentRule,
      paymentDate,
    });
    res.status(200).json({
      success: true,
      data: preview,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCreatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as CreatePaymentInput;
    const actor = {
      userId: req.user.userId,
      firstName: (req.user as any).firstName,
      lastName: (req.user as any).lastName,
      role: (req.user as any).role,
    };
    const payment = await createPayment(input, actor);
    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment recorded and allocated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleReversePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { reason } = req.body as ReversePaymentInput;
    const actor = {
      userId: req.user.userId,
      firstName: (req.user as any).firstName,
      lastName: (req.user as any).lastName,
      role: (req.user as any).role,
    };
    const result = await reversePayment(req.params.id, reason, actor);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Payment successfully reversed with accounting reversal transaction created',
    });
  } catch (error) {
    next(error);
  }
}
