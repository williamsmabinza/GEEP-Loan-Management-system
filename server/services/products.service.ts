import { prisma, isDatabaseConnected } from '../db/prisma.js';
import { LoanProductDTO, RepaymentFrequency } from '../../shared/types/index.js';
import {
  CreateLoanProductInput,
  UpdateLoanProductInput,
} from '../../shared/validators/product.js';
import { AppError } from '../middleware/errorHandler.js';
import { recordAuditLog } from './audit.service.js';
import { logger } from '../utils/logger.js';

const DEMO_PRODUCTS: LoanProductDTO[] = [
  {
    id: 'prod-sme-01',
    code: 'PROD_SME_WORKING_CAPITAL',
    name: 'Commercial Working Capital Facility',
    description: 'Revolving liquidity and capital expansion facility for registered enterprise corporations.',
    minAmount: 25000,
    maxAmount: 500000,
    minTermMonths: 6,
    maxTermMonths: 36,
    baseInterestRate: 8.75,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
    processingFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    processingFeeValue: 1.5,
    insuranceFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    insuranceFeeValue: 0.5,
    penaltyRate: 5.0,
    penaltyType: 'LATE_PAYMENT',
    gracePeriodDays: 5,
    principalGracePeriodMonths: 0,
    status: 'ACTIVE',
    isActive: true,
    tiers: [
      {
        id: 'tier-01',
        tierName: 'Prime Enterprise (Tier 1)',
        minAmount: 100000,
        maxAmount: 500000,
        minTermMonths: 12,
        maxTermMonths: 36,
        rate: 7.95,
        isActive: true,
      },
      {
        id: 'tier-02',
        tierName: 'Standard Commercial (Tier 2)',
        minAmount: 25000,
        maxAmount: 99999.99,
        minTermMonths: 6,
        maxTermMonths: 24,
        rate: 8.75,
        isActive: true,
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-personal-01',
    code: 'PROD_PERSONAL_PREMIER',
    name: 'Premier Salaried Credit Line',
    description: 'Fixed-rate amortized facility for verified high-income professionals.',
    minAmount: 5000,
    maxAmount: 75000,
    minTermMonths: 12,
    maxTermMonths: 60,
    baseInterestRate: 9.50,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
    processingFeeType: 'FIXED_AMOUNT',
    processingFeeValue: 250,
    insuranceFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    insuranceFeeValue: 0.75,
    penaltyRate: 5.0,
    penaltyType: 'LATE_PAYMENT',
    gracePeriodDays: 7,
    principalGracePeriodMonths: 0,
    status: 'ACTIVE',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-equip-01',
    code: 'PROD_COMMERCIAL_EQUIPMENT',
    name: 'Heavy Equipment & Fleet Asset Financing',
    description: 'Asset-backed capital procurement facility for industrial transport, machinery, and fleet vehicles.',
    minAmount: 50000,
    maxAmount: 1500000,
    minTermMonths: 24,
    maxTermMonths: 84,
    baseInterestRate: 6.95,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
    processingFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    processingFeeValue: 1.0,
    insuranceFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    insuranceFeeValue: 0.5,
    penaltyRate: 3.0,
    penaltyType: 'DEFAULT',
    gracePeriodDays: 10,
    principalGracePeriodMonths: 3,
    status: 'ACTIVE',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'prod-agri-01',
    code: 'PROD_AGRI_SEASONAL',
    name: 'Agricultural Seasonal Bullet Facility',
    description: 'Specialized seasonal crop cultivation credit line with quarterly servicing and bullet harvest repayment.',
    minAmount: 10000,
    maxAmount: 250000,
    minTermMonths: 3,
    maxTermMonths: 18,
    baseInterestRate: 8.25,
    interestCalculationMethod: 'FLAT_RATE',
    repaymentFrequency: 'QUARTERLY',
    processingFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    processingFeeValue: 1.25,
    insuranceFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    insuranceFeeValue: 1.0,
    penaltyRate: 4.0,
    penaltyType: 'LATE_PAYMENT',
    gracePeriodDays: 14,
    principalGracePeriodMonths: 6,
    status: 'ACTIVE',
    isActive: true,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'prod-micro-01',
    code: 'PROD_MICRO_BIWEEKLY',
    name: 'Micro-Enterprise Bi-Weekly Capital',
    description: 'Rapid-turnaround working capital with high-frequency bi-weekly collections for retail merchants.',
    minAmount: 1000,
    maxAmount: 20000,
    minTermMonths: 3,
    maxTermMonths: 12,
    baseInterestRate: 11.50,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_PRINCIPAL',
    repaymentFrequency: 'BI_WEEKLY',
    processingFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    processingFeeValue: 2.0,
    insuranceFeeType: 'FIXED_AMOUNT',
    insuranceFeeValue: 50,
    penaltyRate: 5.0,
    penaltyType: 'LATE_PAYMENT',
    gracePeriodDays: 3,
    principalGracePeriodMonths: 0,
    status: 'ACTIVE',
    isActive: true,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
  },
];

const activeMemoryProducts: LoanProductDTO[] = [...DEMO_PRODUCTS];

function mapPrismaProductToDTO(p: any): LoanProductDTO {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    minAmount: Number(p.minAmount),
    maxAmount: Number(p.maxAmount),
    minTermMonths: p.minTermMonths,
    maxTermMonths: p.maxTermMonths,
    // If rate was stored as 0.0875, convert to 8.75 for display/standard percentage
    baseInterestRate:
      Number(p.defaultInterestRate) < 1
        ? Number(p.defaultInterestRate) * 100
        : Number(p.defaultInterestRate),
    interestCalculationMethod: p.interestCalculationMethod,
    repaymentFrequency: p.repaymentFrequency as RepaymentFrequency,
    processingFeeType: p.processingFeeType,
    processingFeeValue:
      p.processingFeeType === 'PERCENTAGE_OF_PRINCIPAL' && Number(p.processingFeeValue) < 1
        ? Number(p.processingFeeValue) * 100
        : Number(p.processingFeeValue),
    insuranceFeeType: p.insuranceFeeType,
    insuranceFeeValue:
      p.insuranceFeeType === 'PERCENTAGE_OF_PRINCIPAL' && Number(p.insuranceFeeValue) < 1
        ? Number(p.insuranceFeeValue) * 100
        : Number(p.insuranceFeeValue),
    penaltyRate:
      Number(p.penaltyRate) < 1 ? Number(p.penaltyRate) * 100 : Number(p.penaltyRate),
    gracePeriodDays: p.gracePeriodDays,
    principalGracePeriodMonths: p.principalGracePeriodMonths,
    status: p.status,
    isActive: p.status === 'ACTIVE',
    tiers: (p.interestRateTiers || []).map((t: any) => ({
      id: t.id,
      tierName: t.tierName,
      minAmount: Number(t.minAmount),
      maxAmount: Number(t.maxAmount),
      minTermMonths: t.minTermMonths,
      maxTermMonths: t.maxTermMonths,
      rate: Number(t.rate) < 1 ? Number(t.rate) * 100 : Number(t.rate),
      isActive: t.isActive,
    })),
    createdAt: p.createdAt ? p.createdAt.toISOString() : undefined,
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : undefined,
  };
}

export async function getAllLoanProducts(includeInactive = true): Promise<LoanProductDTO[]> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const products = await prisma.loanProduct.findMany({
        where: includeInactive ? undefined : { status: 'ACTIVE' },
        include: { interestRateTiers: true },
        orderBy: { createdAt: 'desc' },
      });
      if (products.length > 0) {
        return products.map(mapPrismaProductToDTO);
      }
    } catch (err) {
      logger.error('Error fetching loan products from database:', err);
    }
  }

  // Memory fallback
  return includeInactive
    ? activeMemoryProducts
    : activeMemoryProducts.filter((p) => p.status === 'ACTIVE');
}

export async function getLoanProductById(id: string): Promise<LoanProductDTO> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const p = await prisma.loanProduct.findUnique({
        where: { id },
        include: { interestRateTiers: true },
      });
      if (p) return mapPrismaProductToDTO(p);
    } catch (err) {
      logger.error('Error fetching product by ID from database:', err);
    }
  }

  // Memory fallback
  const found = activeMemoryProducts.find((p) => p.id === id || p.code === id);
  if (!found) throw AppError.notFound('Loan Product');
  return found;
}

export async function createLoanProduct(
  input: CreateLoanProductInput,
  actorUserId: string
): Promise<LoanProductDTO> {
  const isConnected = await isDatabaseConnected();

  // Normalize rate for decimal field if needed (e.g. 8.75% -> 0.0875)
  const defaultInterestRateDecimal = input.baseInterestRate / 100;
  const processingFeeVal =
    input.processingFeeType === 'PERCENTAGE_OF_PRINCIPAL'
      ? input.processingFeeValue / 100
      : input.processingFeeValue;
  const insuranceFeeVal =
    input.insuranceFeeType === 'PERCENTAGE_OF_PRINCIPAL'
      ? input.insuranceFeeValue / 100
      : input.insuranceFeeValue;
  const penaltyRateDecimal = input.penaltyRate / 100;

  if (isConnected) {
    const existing = await prisma.loanProduct.findUnique({
      where: { code: input.code.toUpperCase() },
    });
    if (existing) {
      throw AppError.conflict(`Product with code ${input.code} already exists`);
    }

    const created = await prisma.loanProduct.create({
      data: {
        code: input.code.toUpperCase(),
        name: input.name,
        description: input.description,
        minAmount: input.minAmount,
        maxAmount: input.maxAmount,
        minTermMonths: input.minTermMonths,
        maxTermMonths: input.maxTermMonths,
        defaultInterestRate: defaultInterestRateDecimal,
        interestCalculationMethod: input.interestCalculationMethod as any,
        repaymentFrequency: input.repaymentFrequency as any,
        processingFeeType: input.processingFeeType as any,
        processingFeeValue: processingFeeVal,
        insuranceFeeType: input.insuranceFeeType as any,
        insuranceFeeValue: insuranceFeeVal,
        gracePeriodDays: input.gracePeriodDays,
        principalGracePeriodMonths: input.principalGracePeriodMonths,
        penaltyRate: penaltyRateDecimal,
        status: input.status as any,
      },
      include: { interestRateTiers: true },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'LOAN_PRODUCT_CREATED',
      resource: 'LoanProduct',
      resourceId: created.id,
      details: { code: created.code, name: created.name, interestRate: input.baseInterestRate },
    });

    return mapPrismaProductToDTO(created);
  }

  // Memory fallback
  const existing = activeMemoryProducts.find(
    (p) => p.code.toLowerCase() === input.code.toLowerCase()
  );
  if (existing) {
    throw AppError.conflict(`Product with code ${input.code} already exists`);
  }

  const newId = `prod-${Date.now()}`;
  const newProduct: LoanProductDTO = {
    id: newId,
    code: input.code.toUpperCase(),
    name: input.name,
    description: input.description || null,
    minAmount: input.minAmount,
    maxAmount: input.maxAmount,
    minTermMonths: input.minTermMonths,
    maxTermMonths: input.maxTermMonths,
    baseInterestRate: input.baseInterestRate,
    interestCalculationMethod: input.interestCalculationMethod,
    repaymentFrequency: input.repaymentFrequency,
    processingFeeType: input.processingFeeType,
    processingFeeValue: input.processingFeeValue,
    insuranceFeeType: input.insuranceFeeType,
    insuranceFeeValue: input.insuranceFeeValue,
    gracePeriodDays: input.gracePeriodDays,
    principalGracePeriodMonths: input.principalGracePeriodMonths,
    penaltyRate: input.penaltyRate,
    penaltyType: input.penaltyType,
    status: input.status,
    isActive: input.status === 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  activeMemoryProducts.unshift(newProduct);

  await recordAuditLog({
    userId: actorUserId,
    action: 'LOAN_PRODUCT_CREATED',
    resource: 'LoanProduct',
    resourceId: newId,
    details: { code: newProduct.code, name: newProduct.name, interestRate: input.baseInterestRate },
  });

  return newProduct;
}

export async function updateLoanProduct(
  id: string,
  input: UpdateLoanProductInput,
  actorUserId: string
): Promise<LoanProductDTO> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    const existing = await prisma.loanProduct.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Loan Product');

    const updateData: any = {};
    if (input.code) updateData.code = input.code.toUpperCase();
    if (input.name) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.minAmount !== undefined) updateData.minAmount = input.minAmount;
    if (input.maxAmount !== undefined) updateData.maxAmount = input.maxAmount;
    if (input.minTermMonths !== undefined) updateData.minTermMonths = input.minTermMonths;
    if (input.maxTermMonths !== undefined) updateData.maxTermMonths = input.maxTermMonths;
    if (input.baseInterestRate !== undefined) {
      updateData.defaultInterestRate = input.baseInterestRate / 100;
    }
    if (input.interestCalculationMethod) {
      updateData.interestCalculationMethod = input.interestCalculationMethod as any;
    }
    if (input.repaymentFrequency) {
      updateData.repaymentFrequency = input.repaymentFrequency as any;
    }
    if (input.processingFeeType) {
      updateData.processingFeeType = input.processingFeeType as any;
    }
    if (input.processingFeeValue !== undefined) {
      updateData.processingFeeValue =
        input.processingFeeType === 'PERCENTAGE_OF_PRINCIPAL'
          ? input.processingFeeValue / 100
          : input.processingFeeValue;
    }
    if (input.insuranceFeeType) {
      updateData.insuranceFeeType = input.insuranceFeeType as any;
    }
    if (input.insuranceFeeValue !== undefined) {
      updateData.insuranceFeeValue =
        input.insuranceFeeType === 'PERCENTAGE_OF_PRINCIPAL'
          ? input.insuranceFeeValue / 100
          : input.insuranceFeeValue;
    }
    if (input.gracePeriodDays !== undefined) updateData.gracePeriodDays = input.gracePeriodDays;
    if (input.principalGracePeriodMonths !== undefined) {
      updateData.principalGracePeriodMonths = input.principalGracePeriodMonths;
    }
    if (input.penaltyRate !== undefined) updateData.penaltyRate = input.penaltyRate / 100;
    if (input.status) updateData.status = input.status as any;

    const updated = await prisma.loanProduct.update({
      where: { id },
      data: updateData,
      include: { interestRateTiers: true },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'LOAN_PRODUCT_UPDATED',
      resource: 'LoanProduct',
      resourceId: id,
      details: { updatedFields: Object.keys(input) },
    });

    return mapPrismaProductToDTO(updated);
  }

  // Memory fallback
  const prod = activeMemoryProducts.find((p) => p.id === id);
  if (!prod) throw AppError.notFound('Loan Product');

  if (input.code) prod.code = input.code.toUpperCase();
  if (input.name) prod.name = input.name;
  if (input.description !== undefined) prod.description = input.description || null;
  if (input.minAmount !== undefined) prod.minAmount = input.minAmount;
  if (input.maxAmount !== undefined) prod.maxAmount = input.maxAmount;
  if (input.minTermMonths !== undefined) prod.minTermMonths = input.minTermMonths;
  if (input.maxTermMonths !== undefined) prod.maxTermMonths = input.maxTermMonths;
  if (input.baseInterestRate !== undefined) prod.baseInterestRate = input.baseInterestRate;
  if (input.interestCalculationMethod) {
    prod.interestCalculationMethod = input.interestCalculationMethod;
  }
  if (input.repaymentFrequency) prod.repaymentFrequency = input.repaymentFrequency;
  if (input.processingFeeType) prod.processingFeeType = input.processingFeeType;
  if (input.processingFeeValue !== undefined) prod.processingFeeValue = input.processingFeeValue;
  if (input.insuranceFeeType) prod.insuranceFeeType = input.insuranceFeeType;
  if (input.insuranceFeeValue !== undefined) prod.insuranceFeeValue = input.insuranceFeeValue;
  if (input.gracePeriodDays !== undefined) prod.gracePeriodDays = input.gracePeriodDays;
  if (input.principalGracePeriodMonths !== undefined) {
    prod.principalGracePeriodMonths = input.principalGracePeriodMonths;
  }
  if (input.penaltyRate !== undefined) prod.penaltyRate = input.penaltyRate;
  if (input.penaltyType) prod.penaltyType = input.penaltyType;
  if (input.status) {
    prod.status = input.status;
    prod.isActive = input.status === 'ACTIVE';
  }
  prod.updatedAt = new Date().toISOString();

  await recordAuditLog({
    userId: actorUserId,
    action: 'LOAN_PRODUCT_UPDATED',
    resource: 'LoanProduct',
    resourceId: id,
    details: { updatedFields: Object.keys(input) },
  });

  return prod;
}

export async function toggleLoanProductStatus(
  id: string,
  newStatus: string,
  actorUserId: string
): Promise<LoanProductDTO> {
  return updateLoanProduct(id, { status: newStatus as any }, actorUserId);
}

export async function deleteLoanProduct(id: string, actorUserId: string): Promise<void> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    const existing = await prisma.loanProduct.findUnique({
      where: { id },
      include: { loans: true },
    });
    if (!existing) throw AppError.notFound('Loan Product');
    if (existing.loans.length > 0) {
      throw AppError.badRequest('Cannot delete loan product that is tied to active or historical loans.');
    }
    await prisma.loanProduct.delete({ where: { id } });
    await recordAuditLog({
      userId: actorUserId,
      action: 'LOAN_PRODUCT_DELETED',
      resource: 'LoanProduct',
      resourceId: id,
    });
    return;
  }

  // Memory fallback
  const idx = activeMemoryProducts.findIndex((p) => p.id === id);
  if (idx === -1) throw AppError.notFound('Loan Product');
  activeMemoryProducts.splice(idx, 1);

  await recordAuditLog({
    userId: actorUserId,
    action: 'LOAN_PRODUCT_DELETED',
    resource: 'LoanProduct',
    resourceId: id,
  });
}
