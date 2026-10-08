import { Request, Response, NextFunction } from 'express';
import {
  getAllLoanProducts,
  getLoanProductById,
  createLoanProduct,
  updateLoanProduct,
  toggleLoanProductStatus,
  deleteLoanProduct,
} from '../services/products.service.js';
import { calculateLoan } from '../services/loan-calculator.service.js';
import {
  CreateLoanProductInput,
  UpdateLoanProductInput,
  CalculateLoanInput,
} from '../../shared/validators/product.js';
import { AppError } from '../middleware/errorHandler.js';

export async function handleGetAllProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.all === 'true';
    const products = await getAllLoanProducts(includeInactive);
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const product = await getLoanProductById(req.params.id);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCreateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as CreateLoanProductInput;
    const product = await createLoanProduct(input, req.user.userId);
    res.status(201).json({
      success: true,
      data: product,
      message: 'Loan product created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const input = req.body as UpdateLoanProductInput;
    const product = await updateLoanProduct(req.params.id, input, req.user.userId);
    res.status(200).json({
      success: true,
      data: product,
      message: 'Loan product updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleToggleProductStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    const { status } = req.body;
    if (!status) throw AppError.badRequest('Status is required');
    const product = await toggleLoanProductStatus(req.params.id, status, req.user.userId);
    res.status(200).json({
      success: true,
      data: product,
      message: `Loan product status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw AppError.unauthorized();
    await deleteLoanProduct(req.params.id, req.user.userId);
    res.status(200).json({
      success: true,
      message: 'Loan product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function handleCalculateLoan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = req.body as CalculateLoanInput;
    const result = calculateLoan(input);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
