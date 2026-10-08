import { prisma, isDatabaseConnected } from '../db/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  LoanDTO,
  LoanProductDTO,
  LoanPortfolioStatsDTO,
  LoanStatus,
  RepaymentFrequency,
  PaymentStatus,
  PaymentMethod,
  LoanDisbursementDTO,
  CustomerLoanSummaryDTO,
  LoanApplicationDTO,
} from '../../shared/types/index.js';
import {
  CreateLoanApplicationInput,
  RecordPaymentInput,
  UpdateLoanStatusInput,
  DisburseLoanInput,
} from '../../shared/validators/loan.js';
import { logger } from '../utils/logger.js';
import { recordAuditLog } from './audit.service.js';
import { dispatchNotification } from './notification.service.js';
import { calculateLoan } from './loan-calculator.service.js';
import { getAllLoanProducts } from './products.service.js';

// Actuarial calculation for standard amortized credit facilities (delegates to decimal-safe calculator)
export function calculateAmortization(principal: number, annualRatePct: number, termMonths: number) {
  const result = calculateLoan({
    principal,
    annualRate: annualRatePct,
    termMonths,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
  });
  return {
    monthlyInstallment: result.installmentAmount,
    totalPayable: result.totalPayable,
    totalInterest: result.totalInterest,
  };
}

export function generateScheduleItems(
  loanId: string,
  principal: number,
  annualRatePct: number,
  termMonths: number,
  _monthlyInstallment?: number,
  startDate = new Date(),
  method: any = 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
  frequency: any = 'MONTHLY'
) {
  const result = calculateLoan({
    principal,
    annualRate: annualRatePct,
    termMonths,
    interestCalculationMethod: method,
    repaymentFrequency: frequency,
    startDate: startDate.toISOString().split('T')[0],
  });

  return result.schedule.map((r) => ({
    id: `sched-${loanId}-${r.installmentNumber}`,
    installmentNumber: r.installmentNumber,
    dueDate: r.dueDate,
    principalDue: r.principalDue,
    interestDue: r.interestDue,
    feesDue: r.feesDue,
    penaltyDue: 0,
    totalDue: r.totalDue,
    principalPaid: 0,
    interestPaid: 0,
    totalPaid: 0,
    amountPaid: 0,
    outstandingAmount: r.totalDue,
    status: 'SCHEDULED' as PaymentStatus,
    paidDate: null,
  }));
}

const INITIAL_PRODUCTS: LoanProductDTO[] = [
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
    processingFeeValue: 1.5,
    penaltyRate: 5.0,
    gracePeriodDays: 5,
    isActive: true,
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
    processingFeeValue: 250,
    penaltyRate: 5.0,
    gracePeriodDays: 7,
    isActive: true,
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
    processingFeeValue: 1.0,
    penaltyRate: 3.0,
    gracePeriodDays: 10,
    isActive: true,
  },
];

export const memoryLoans: LoanDTO[] = [
  {
    id: 'loan-sme-0042',
    loanNumber: 'LN-2026-0042',
    customerId: 'cust-01',
    borrowerId: 'user-cust-01',
    borrower: {
      id: 'user-cust-01',
      email: 'customer@nexa.financial',
      firstName: 'Alexander',
      lastName: 'Hayes',
      phoneNumber: '+1 (555) 017-4490',
    },
    productId: 'prod-sme-01',
    product: INITIAL_PRODUCTS[0],
    principalAmount: 100000,
    interestRate: 8.75,
    termMonths: 24,
    repaymentFrequency: 'MONTHLY',
    totalInterest: 9410.00,
    totalPayable: 109410.00,
    monthlyInstallment: 4558.75,
    remainingBalance: 82057.50,
    totalPaidAmount: 27352.50,
    status: 'ACTIVE',
    purpose: 'Warehouse automation and inventory expansion for logistics fulfillment center.',
    notes: 'Verified commercial inventory lien recorded.',
    applicationDate: '2026-01-10T10:00:00.000Z',
    approvedAt: '2026-01-15T14:30:00.000Z',
    disbursedAt: '2026-01-20T10:00:00.000Z',
    maturityDate: '2028-01-20',
    reviewerId: 'staff-off-01',
    reviewer: {
      id: 'staff-off-01',
      firstName: 'Marcus',
      lastName: 'Vance',
    },
    reviewNotes: 'Credit profile verified. DTI ratio is 28.4%. 12mo positive operational cash flow.',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
    repayments: generateScheduleItems('loan-sme-0042', 100000, 8.75, 24, 4558.75, new Date('2026-01-20')).map(
      (s, idx) => {
        if (idx < 6) {
          return {
            ...s,
            status: 'PAID' as PaymentStatus,
            amountPaid: s.totalDue,
            totalPaid: s.totalDue,
            outstandingAmount: 0,
            paidDate: s.dueDate,
          };
        }
        return s;
      }
    ),
    payments: [
      {
        id: 'txn-001',
        transactionRef: 'PAY-2026-1001',
        receiptNumber: 'RCP-NEXA-2026-001',
        loanId: 'loan-sme-0042',
        amount: 4558.75,
        paymentDate: '2026-02-20T10:00:00.000Z',
        method: 'BANK_TRANSFER',
        status: 'FULLY_ALLOCATED',
        notes: 'Monthly direct debit settlement - Installment #1',
        receivedBy: { id: 'staff-off-01', firstName: 'Marcus', lastName: 'Vance' },
      },
    ],
    collaterals: [
      {
        id: 'col-001',
        collateralType: 'REAL_ESTATE',
        description: 'Commercial Logistics Warehouse Facility (Seattle Port Corridor)',
        valuationAmount: 420000,
        pledgedAmount: 150000,
        status: 'PLEDGED',
      },
    ],
    guarantors: [
      {
        id: 'guar-001',
        name: 'Robert Vance Sterling',
        phone: '+1 (555) 012-9988',
        relationship: 'Commercial Business Partner',
        guaranteedAmount: 50000,
        status: 'ACCEPTED',
      },
    ],
    disbursements: [
      {
        id: 'disb-001',
        disbursementReference: 'DISB-2026-0042',
        amount: 100000,
        disbursementDate: '2026-01-20T10:00:00.000Z',
        paymentMethod: 'BANK_TRANSFER',
        destinationAccount: 'JPMorgan Chase Bank •••• 9821',
        status: 'PROCESSED',
      },
    ],
  },
  {
    id: 'loan-pers-0089',
    loanNumber: 'LN-2026-0089',
    customerId: 'cust-01',
    borrowerId: 'user-cust-01',
    borrower: {
      id: 'user-cust-01',
      email: 'customer@nexa.financial',
      firstName: 'Alexander',
      lastName: 'Hayes',
      phoneNumber: '+1 (555) 017-4490',
    },
    productId: 'prod-personal-01',
    product: INITIAL_PRODUCTS[1],
    principalAmount: 35000,
    interestRate: 9.50,
    termMonths: 36,
    repaymentFrequency: 'MONTHLY',
    totalInterest: 5382.40,
    totalPayable: 40382.40,
    monthlyInstallment: 1121.73,
    remainingBalance: 40382.40,
    totalPaidAmount: 0,
    status: 'PENDING_DISBURSEMENT',
    purpose: 'Executive commercial certification and business leadership training program.',
    applicationDate: '2026-09-28T11:20:00.000Z',
    approvedAt: '2026-10-01T15:00:00.000Z',
    createdAt: '2026-09-28T11:20:00.000Z',
    updatedAt: '2026-10-01T15:00:00.000Z',
    repayments: generateScheduleItems('loan-pers-0089', 35000, 9.50, 36, 1121.73, new Date('2026-09-28')),
    payments: [],
  },
];

export async function getLoanProducts(): Promise<LoanProductDTO[]> {
  return getAllLoanProducts(false);
}

export async function getAllLoans(filters?: {
  borrowerId?: string;
  status?: string;
  customerId?: string;
}): Promise<LoanDTO[]> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      // Find customer if borrowerId is a User ID
      let customerIdFilter: string | undefined = filters?.customerId;
      if (filters?.borrowerId && !customerIdFilter) {
        const cust = await prisma.customer.findFirst({
          where: { OR: [{ id: filters.borrowerId }, { userId: filters.borrowerId }] },
        });
        if (cust) customerIdFilter = cust.id;
      }

      const loans = await prisma.loan.findMany({
        where: {
          ...(customerIdFilter ? { customerId: customerIdFilter } : {}),
          ...(filters?.status && filters.status !== 'ALL' ? { status: filters.status as any } : {}),
        },
        include: {
          customer: { include: { branch: true } },
          loanProduct: true,
          application: {
            include: {
              approvedByStaff: true,
              loanOfficer: true,
            },
          },
          repaymentSchedules: { orderBy: { installmentNumber: 'asc' } },
          payments: { orderBy: { paymentDate: 'desc' } },
          collaterals: true,
          guarantors: true,
          disbursements: true,
          branch: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return loans.map((l) => ({
        id: l.id,
        loanNumber: l.loanNumber,
        customerId: l.customerId,
        borrowerId: l.customer.userId || l.customerId,
        borrower: {
          id: l.customer.userId || l.customer.id,
          email: l.customer.email,
          firstName: l.customer.firstName,
          lastName: l.customer.lastName,
          phoneNumber: l.customer.phone,
        },
        customer: {
          id: l.customer.id,
          customerNumber: l.customer.customerNumber,
          firstName: l.customer.firstName,
          lastName: l.customer.lastName,
          email: l.customer.email,
          phone: l.customer.phone,
          idType: l.customer.idType,
          idNumber: l.customer.idNumber,
          employmentType: l.customer.employmentType,
          monthlyIncome: Number(l.customer.monthlyIncome),
          profileStatus: l.customer.profileStatus,
          kycStatus: l.customer.kycStatus,
        },
        productId: l.loanProductId,
        product: {
          id: l.loanProduct.id,
          code: l.loanProduct.code,
          name: l.loanProduct.name,
          description: l.loanProduct.description,
          minAmount: Number(l.loanProduct.minAmount),
          maxAmount: Number(l.loanProduct.maxAmount),
          minTermMonths: l.loanProduct.minTermMonths,
          maxTermMonths: l.loanProduct.maxTermMonths,
          baseInterestRate: Number(l.loanProduct.defaultInterestRate) * (l.loanProduct.defaultInterestRate.toNumber() < 1 ? 100 : 1),
          interestCalculationMethod: l.loanProduct.interestCalculationMethod,
          repaymentFrequency: l.loanProduct.repaymentFrequency as RepaymentFrequency,
          processingFeeValue: Number(l.loanProduct.processingFeeValue),
          penaltyRate: Number(l.loanProduct.penaltyRate),
          gracePeriodDays: l.loanProduct.gracePeriodDays,
          isActive: l.loanProduct.status === 'ACTIVE',
        },
        principalAmount: Number(l.principalAmount),
        interestRate: Number(l.interestRate) * (l.interestRate.toNumber() < 1 ? 100 : 1),
        termMonths: l.termMonths,
        repaymentFrequency: l.repaymentFrequency as RepaymentFrequency,
        totalInterest: Number(l.totalInterestExpected),
        totalPayable: Number(l.totalAmountExpected),
        monthlyInstallment: Number(l.monthlyInstallment),
        remainingBalance: Number(l.totalOutstandingBalance),
        totalPaidAmount: Number(l.totalPaidAmount),
        status: l.status as LoanStatus,
        purpose: l.application?.purpose || 'Credit Facility',
        notes: l.application?.approvalNotes || null,
        applicationDate: (l.application?.applicationDate || l.createdAt).toISOString(),
        approvedAt: l.approvalDate ? l.approvalDate.toISOString() : null,
        disbursedAt: l.disbursementDate ? l.disbursementDate.toISOString() : null,
        maturityDate: l.maturityDate ? l.maturityDate.toISOString() : null,
        closedAt: l.closedDate ? l.closedDate.toISOString() : null,
        reviewerId: l.application?.approvedByStaffId || null,
        reviewer: l.application?.approvedByStaff
          ? {
              id: l.application.approvedByStaff.id,
              firstName: l.application.approvedByStaff.firstName,
              lastName: l.application.approvedByStaff.lastName,
            }
          : null,
        reviewNotes: l.application?.approvalNotes || null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
        repayments: l.repaymentSchedules.map((r) => ({
          id: r.id,
          installmentNumber: r.installmentNumber,
          dueDate: r.dueDate.toISOString(),
          principalDue: Number(r.principalDue),
          interestDue: Number(r.interestDue),
          feesDue: Number(r.feesDue),
          penaltyDue: Number(r.penaltyDue),
          totalDue: Number(r.totalDue),
          principalPaid: Number(r.principalPaid),
          interestPaid: Number(r.interestPaid),
          totalPaid: Number(r.totalPaid),
          outstandingAmount: Number(r.outstandingAmount),
          status: r.status as PaymentStatus,
          paidDate: r.paidDate ? r.paidDate.toISOString() : null,
        })),
        payments: l.payments.map((p) => ({
          id: p.id,
          transactionRef: p.paymentReference,
          receiptNumber: p.receiptNumber,
          loanId: p.loanId,
          amount: Number(p.amount),
          paymentDate: p.paymentDate.toISOString(),
          method: p.paymentMethod as PaymentMethod,
          status: p.allocationStatus,
          notes: p.notes,
        })),
      }));
    } catch (err) {
      logger.error('Error querying loans from MySQL:', err);
    }
  }

  let list = [...memoryLoans];
  if (filters?.customerId) {
    list = list.filter((l) => l.customerId === filters.customerId || l.borrowerId === filters.customerId);
  }
  if (filters?.borrowerId) {
    list = list.filter((l) => l.borrowerId === filters.borrowerId || l.customerId === filters.borrowerId);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((l) => l.status === filters.status);
  }
  return list;
}

export async function getLoanById(loanId: string): Promise<LoanDTO> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    const l = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        customer: { include: { branch: true } },
        loanProduct: true,
        application: {
          include: {
            approvedByStaff: true,
            loanOfficer: true,
          },
        },
        repaymentSchedules: { orderBy: { installmentNumber: 'asc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        collaterals: true,
        guarantors: true,
        disbursements: true,
        branch: true,
      },
    });

    if (!l) throw AppError.notFound('Loan');

    return {
      id: l.id,
      loanNumber: l.loanNumber,
      customerId: l.customerId,
      borrowerId: l.customer.userId || l.customerId,
      borrower: {
        id: l.customer.userId || l.customer.id,
        email: l.customer.email,
        firstName: l.customer.firstName,
        lastName: l.customer.lastName,
        phoneNumber: l.customer.phone,
      },
      productId: l.loanProductId,
      product: {
        id: l.loanProduct.id,
        code: l.loanProduct.code,
        name: l.loanProduct.name,
        description: l.loanProduct.description,
        minAmount: Number(l.loanProduct.minAmount),
        maxAmount: Number(l.loanProduct.maxAmount),
        minTermMonths: l.loanProduct.minTermMonths,
        maxTermMonths: l.loanProduct.maxTermMonths,
        baseInterestRate: Number(l.loanProduct.defaultInterestRate) * (l.loanProduct.defaultInterestRate.toNumber() < 1 ? 100 : 1),
        interestCalculationMethod: l.loanProduct.interestCalculationMethod,
        repaymentFrequency: l.loanProduct.repaymentFrequency as RepaymentFrequency,
        processingFeeValue: Number(l.loanProduct.processingFeeValue),
        penaltyRate: Number(l.loanProduct.penaltyRate),
        gracePeriodDays: l.loanProduct.gracePeriodDays,
        isActive: l.loanProduct.status === 'ACTIVE',
      },
      principalAmount: Number(l.principalAmount),
      interestRate: Number(l.interestRate) * (l.interestRate.toNumber() < 1 ? 100 : 1),
      termMonths: l.termMonths,
      repaymentFrequency: l.repaymentFrequency as RepaymentFrequency,
      totalInterest: Number(l.totalInterestExpected),
      totalPayable: Number(l.totalAmountExpected),
      monthlyInstallment: Number(l.monthlyInstallment),
      remainingBalance: Number(l.totalOutstandingBalance),
      totalPaidAmount: Number(l.totalPaidAmount),
      status: l.status as LoanStatus,
      purpose: l.application?.purpose || 'Credit Facility',
      notes: l.application?.approvalNotes || null,
      applicationDate: (l.application?.applicationDate || l.createdAt).toISOString(),
      approvedAt: l.approvalDate ? l.approvalDate.toISOString() : null,
      disbursedAt: l.disbursementDate ? l.disbursementDate.toISOString() : null,
      maturityDate: l.maturityDate ? l.maturityDate.toISOString() : null,
      closedAt: l.closedDate ? l.closedDate.toISOString() : null,
      reviewerId: l.application?.approvedByStaffId || null,
      reviewer: l.application?.approvedByStaff
        ? {
            id: l.application.approvedByStaff.id,
            firstName: l.application.approvedByStaff.firstName,
            lastName: l.application.approvedByStaff.lastName,
          }
        : null,
      reviewNotes: l.application?.approvalNotes || null,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      repayments: l.repaymentSchedules.map((r) => ({
        id: r.id,
        installmentNumber: r.installmentNumber,
        dueDate: r.dueDate.toISOString(),
        principalDue: Number(r.principalDue),
        interestDue: Number(r.interestDue),
        feesDue: Number(r.feesDue),
        penaltyDue: Number(r.penaltyDue),
        totalDue: Number(r.totalDue),
        principalPaid: Number(r.principalPaid),
        interestPaid: Number(r.interestPaid),
        totalPaid: Number(r.totalPaid),
        outstandingAmount: Number(r.outstandingAmount),
        status: r.status as PaymentStatus,
        paidDate: r.paidDate ? r.paidDate.toISOString() : null,
      })),
      payments: l.payments.map((p) => ({
        id: p.id,
        transactionRef: p.paymentReference,
        receiptNumber: p.receiptNumber,
        loanId: p.loanId,
        amount: Number(p.amount),
        paymentDate: p.paymentDate.toISOString(),
        method: p.paymentMethod as PaymentMethod,
        status: p.allocationStatus,
        notes: p.notes,
      })),
    };
  }

  const found = memoryLoans.find((l) => l.id === loanId);
  if (!found) throw AppError.notFound('Loan');
  return found;
}

export async function createLoanApplication(
  userId: string,
  input: CreateLoanApplicationInput,
  borrowerUser?: { email: string; firstName: string; lastName: string }
): Promise<LoanDTO> {
  const products = await getLoanProducts();
  const product = products.find((p) => p.id === input.productId);
  if (!product) {
    throw AppError.badRequest('Selected loan product does not exist or is inactive');
  }

  const interestRate = product.baseInterestRate;
  const calcResult = calculateLoan({
    principal: input.principalAmount,
    annualRate: interestRate,
    termMonths: input.termMonths,
    interestCalculationMethod: product.interestCalculationMethod as any,
    repaymentFrequency: (input.repaymentFrequency || product.repaymentFrequency) as any,
    processingFeeType: product.processingFeeType,
    processingFeeValue: product.processingFeeValue,
    insuranceFeeType: product.insuranceFeeType,
    insuranceFeeValue: product.insuranceFeeValue,
  });

  const monthlyInstallment = calcResult.installmentAmount;
  const totalInterest = calcResult.totalInterest;
  const totalPayable = calcResult.totalPayable;

  const loanSeq = Math.floor(1000 + Math.random() * 9000);
  const loanNumber = `LN-2026-${loanSeq}`;
  const appNumber = `APP-2026-${loanSeq}`;
  const loanId = `loan-${Date.now()}`;

  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      let customer = await prisma.customer.findFirst({
        where: { OR: [{ userId }, { id: userId }] },
      });

      if (!customer) {
        let branch = await prisma.branch.findFirst({ where: { status: 'ACTIVE' } });
        customer = await prisma.customer.create({
          data: {
            customerNumber: `CUST-${loanSeq}`,
            userId,
            branchId: branch?.id || '',
            firstName: borrowerUser?.firstName || 'Borrower',
            lastName: borrowerUser?.lastName || 'Client',
            email: borrowerUser?.email || `client-${loanSeq}@nexa.financial`,
            phone: '+1 (555) 000-0000',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'PREFER_NOT_TO_SAY',
            idNumber: `ID-${loanSeq}`,
            addressLine1: 'Address On File',
            city: 'Seattle',
            state: 'WA',
          },
        });
      }

      // Create LoanApplication
      const application = await prisma.loanApplication.create({
        data: {
          applicationNumber: appNumber,
          customerId: customer.id,
          loanProductId: product.id,
          branchId: customer.branchId,
          requestedAmount: input.principalAmount,
          requestedTermMonths: input.termMonths,
          purpose: input.purpose,
          status: 'SUBMITTED',
        },
      });

      // Create Loan record
      const repayments = calcResult.schedule.map((r) => ({
        id: `sched-${loanId}-${r.installmentNumber}`,
        installmentNumber: r.installmentNumber,
        dueDate: r.dueDate,
        principalDue: r.principalDue,
        interestDue: r.interestDue,
        feesDue: r.feesDue,
        penaltyDue: 0,
        totalDue: r.totalDue,
        principalPaid: 0,
        interestPaid: 0,
        totalPaid: 0,
        amountPaid: 0,
        outstandingAmount: r.totalDue,
        status: 'SCHEDULED' as PaymentStatus,
        paidDate: null,
      }));

      const createdLoan = await prisma.loan.create({
        data: {
          loanNumber,
          customerId: customer.id,
          applicationId: application.id,
          loanProductId: product.id,
          branchId: customer.branchId,
          principalAmount: input.principalAmount,
          interestRate: interestRate / 100,
          termMonths: input.termMonths,
          repaymentFrequency: input.repaymentFrequency as any,
          totalInterestExpected: totalInterest,
          totalFeesExpected: 0,
          totalAmountExpected: totalPayable,
          outstandingPrincipal: input.principalAmount,
          outstandingInterest: totalInterest,
          totalOutstandingBalance: totalPayable,
          monthlyInstallment,
          status: 'PENDING_DISBURSEMENT',
          repaymentSchedules: {
            create: repayments.map((r) => ({
              installmentNumber: r.installmentNumber,
              dueDate: new Date(r.dueDate),
              principalDue: r.principalDue,
              interestDue: r.interestDue,
              totalDue: r.totalDue,
              outstandingAmount: r.totalDue,
              status: 'SCHEDULED',
            })),
          },
        },
      });

      await recordAuditLog({
        userId,
        action: 'LOAN_APPLICATION_CREATED',
        resource: 'LoanApplication',
        resourceId: application.id,
        details: { loanNumber, amount: input.principalAmount, product: product.name },
      });

      return getLoanById(createdLoan.id);
    } catch (err) {
      logger.error('Error creating loan application in MySQL:', err);
    }
  }

  // Memory fallback
  const repayments = calcResult.schedule.map((r) => ({
    id: `sched-${loanId}-${r.installmentNumber}`,
    installmentNumber: r.installmentNumber,
    dueDate: r.dueDate,
    principalDue: r.principalDue,
    interestDue: r.interestDue,
    feesDue: r.feesDue,
    penaltyDue: 0,
    totalDue: r.totalDue,
    principalPaid: 0,
    interestPaid: 0,
    totalPaid: 0,
    amountPaid: 0,
    outstandingAmount: r.totalDue,
    status: 'SCHEDULED' as PaymentStatus,
    paidDate: null,
  }));

  const newLoan: LoanDTO = {
    id: loanId,
    loanNumber,
    customerId: `cust-${userId}`,
    borrowerId: userId,
    borrower: borrowerUser
      ? { id: userId, email: borrowerUser.email, firstName: borrowerUser.firstName, lastName: borrowerUser.lastName }
      : { id: userId, email: 'applicant@nexa.financial', firstName: 'Customer', lastName: 'Applicant' },
    productId: product.id,
    product,
    principalAmount: input.principalAmount,
    interestRate,
    termMonths: input.termMonths,
    repaymentFrequency: input.repaymentFrequency as RepaymentFrequency,
    totalInterest,
    totalPayable,
    monthlyInstallment,
    remainingBalance: totalPayable,
    totalPaidAmount: 0,
    status: 'PENDING_DISBURSEMENT',
    purpose: input.purpose,
    notes: input.notes || null,
    applicationDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repayments,
    payments: [],
  };

  memoryLoans.unshift(newLoan);

  await recordAuditLog({
    userId,
    action: 'LOAN_APPLICATION_CREATED',
    resource: 'LoanApplication',
    resourceId: newLoan.id,
    details: { loanNumber, amount: input.principalAmount, product: product.name },
  });

  return newLoan;
}

export async function updateLoanStatus(
  loanId: string,
  reviewerStaffUserId: string,
  reviewerName: { firstName: string; lastName: string },
  input: UpdateLoanStatusInput
): Promise<LoanDTO> {
  const isConnected = await isDatabaseConnected();
  const now = new Date();

  if (isConnected) {
    try {
      const current = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { application: true },
      });
      if (!current) throw AppError.notFound('Loan');

      let targetLoanStatus: LoanStatus = 'PENDING_DISBURSEMENT';
      if (input.status === 'APPROVED' || input.status === 'ACTIVE') {
        targetLoanStatus = 'ACTIVE';
      } else if (input.status === 'REJECTED') {
        targetLoanStatus = 'WRITTEN_OFF';
      } else if (input.status === 'CLOSED') {
        targetLoanStatus = 'CLOSED_PAID_OFF';
      }

      await prisma.loan.update({
        where: { id: loanId },
        data: {
          status: targetLoanStatus,
          approvalDate: input.status === 'APPROVED' ? now : current.approvalDate,
          disbursementDate: input.status === 'ACTIVE' || input.status === 'DISBURSED' ? now : current.disbursementDate,
          closedDate: input.status === 'CLOSED' ? now : current.closedDate,
        },
      });

      if (current.applicationId) {
        await prisma.loanApplication.update({
          where: { id: current.applicationId },
          data: {
            status: input.status === 'APPROVED' ? 'APPROVED' : input.status === 'REJECTED' ? 'REJECTED' : 'UNDER_REVIEW',
            approvalDate: input.status === 'APPROVED' ? now : undefined,
            approvalNotes: input.reviewNotes || undefined,
            rejectionDate: input.status === 'REJECTED' ? now : undefined,
            rejectionReason: input.status === 'REJECTED' ? input.reviewNotes || 'Underwriting criteria not met' : undefined,
          },
        });
      }

      await recordAuditLog({
        userId: reviewerStaffUserId,
        action: 'LOAN_STATUS_CHANGED',
        resource: 'Loan',
        resourceId: loanId,
        details: { previousStatus: current.status, newStatus: input.status, reviewer: reviewerName },
      });

      return getLoanById(loanId);
    } catch (err) {
      logger.error('Error updating loan status in MySQL:', err);
    }
  }

  // Memory fallback
  const loanIndex = memoryLoans.findIndex((l) => l.id === loanId);
  if (loanIndex === -1) throw AppError.notFound('Loan');

  const prev = memoryLoans[loanIndex];
  const updated: LoanDTO = {
    ...prev,
    status: (input.status === 'APPROVED' ? 'ACTIVE' : input.status) as LoanStatus,
    reviewerId: reviewerStaffUserId,
    reviewer: reviewerName ? { id: reviewerStaffUserId, ...reviewerName } : prev.reviewer,
    reviewNotes: input.reviewNotes || prev.reviewNotes,
    approvedAt: input.status === 'APPROVED' ? now.toISOString() : prev.approvedAt,
    disbursedAt: input.status === 'ACTIVE' || input.status === 'DISBURSED' ? now.toISOString() : prev.disbursedAt,
    closedAt: input.status === 'CLOSED' ? now.toISOString() : prev.closedAt,
    updatedAt: now.toISOString(),
  };

  memoryLoans[loanIndex] = updated;

  await recordAuditLog({
    userId: reviewerStaffUserId,
    action: 'LOAN_STATUS_CHANGED',
    resource: 'Loan',
    resourceId: loanId,
    details: { previousStatus: prev.status, newStatus: input.status, reviewer: reviewerName },
  });

  return updated;
}

export async function recordLoanPayment(
  loanId: string,
  userId: string,
  input: RecordPaymentInput
): Promise<LoanDTO> {
  const loan = await getLoanById(loanId);
  const now = new Date();
  const payRef = `PAY-${Date.now()}`;
  const receiptNum = `RCP-NEXA-${Math.floor(10000 + Math.random() * 90000)}`;

  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      await prisma.$transaction(async (tx) => {
        // Record payment
        const payment = await tx.payment.create({
          data: {
            paymentReference: payRef,
            receiptNumber: receiptNum,
            customerId: loan.customerId,
            loanId,
            amount: input.amount,
            paymentMethod: input.method as any,
            paymentDate: now,
            allocationStatus: 'FULLY_ALLOCATED',
            notes: input.notes || 'Repayment via portal',
          },
        });

        // Deduct from outstanding balance
        const newBalance = Math.max(0, loan.remainingBalance - input.amount);
        await tx.loan.update({
          where: { id: loanId },
          data: {
            totalOutstandingBalance: newBalance,
            totalPaidAmount: { increment: input.amount },
            ...(newBalance <= 0 ? { status: 'CLOSED_PAID_OFF', closedDate: now } : {}),
          },
        });

        // Update first unpaid repayment schedule
        const firstUnpaid = await tx.repaymentSchedule.findFirst({
          where: { loanId, status: { in: ['SCHEDULED', 'PARTIALLY_PAID', 'OVERDUE'] } },
          orderBy: { installmentNumber: 'asc' },
        });

        if (firstUnpaid) {
          const isFull = input.amount >= Number(firstUnpaid.totalDue);
          await tx.repaymentSchedule.update({
            where: { id: firstUnpaid.id },
            data: {
              totalPaid: { increment: input.amount },
              principalPaid: { increment: input.amount },
              outstandingAmount: Math.max(0, Number(firstUnpaid.totalDue) - input.amount),
              status: isFull ? 'PAID' : 'PARTIALLY_PAID',
              paidDate: now,
            },
          });

          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              repaymentScheduleId: firstUnpaid.id,
              principalAllocated: input.amount,
              totalAllocated: input.amount,
              allocatedAt: now,
            },
          });
        }
      });

      await recordAuditLog({
        userId,
        action: 'PAYMENT_RECORDED',
        resource: 'Payment',
        resourceId: loanId,
        details: { amount: input.amount, method: input.method, payRef },
      });

      return getLoanById(loanId);
    } catch (err) {
      logger.error('Error posting payment in MySQL:', err);
    }
  }

  // Memory fallback
  const loanIndex = memoryLoans.findIndex((l) => l.id === loanId);
  const newBalance = Math.max(0, Math.round((loan.remainingBalance - input.amount) * 100) / 100);

  const updatedLoan: LoanDTO = {
    ...loan,
    remainingBalance: newBalance,
    totalPaidAmount: (loan.totalPaidAmount || 0) + input.amount,
    status: newBalance <= 0 ? 'CLOSED_PAID_OFF' : loan.status,
    closedAt: newBalance <= 0 ? now.toISOString() : loan.closedAt,
    payments: [
      {
        id: `txn-${Date.now()}`,
        transactionRef: payRef,
        receiptNumber: receiptNum,
        loanId,
        amount: input.amount,
        paymentDate: now.toISOString(),
        method: input.method as PaymentMethod,
        status: 'FULLY_ALLOCATED',
        notes: input.notes || 'Borrower payment',
      },
      ...(loan.payments || []),
    ],
  };

  memoryLoans[loanIndex] = updatedLoan;

  await recordAuditLog({
    userId,
    action: 'PAYMENT_RECORDED',
    resource: 'Payment',
    resourceId: loanId,
    details: { amount: input.amount, method: input.method, payRef },
  });

  return updatedLoan;
}

export async function getPortfolioStats(): Promise<LoanPortfolioStatsDTO> {
  const loans = await getAllLoans();

  const totalLoanCount = loans.length;
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
  const pendingReview = loans.filter((l) => l.status === 'PENDING_DISBURSEMENT');
  const delinquentLoans = loans.filter((l) => l.status === 'IN_ARREARS' || l.status === 'DELINQUENT' || l.status === 'DEFAULTED');

  const totalDisbursedVolume = activeLoans.reduce((sum, l) => sum + l.principalAmount, 0);
  const totalOutstandingBalance = activeLoans.reduce((sum, l) => sum + l.remainingBalance, 0);

  const totalCollections = loans
    .flatMap((l) => l.payments || [])
    .reduce((sum, p) => sum + p.amount, 0);

  const delinquencyRate =
    totalLoanCount > 0 ? Math.round((delinquentLoans.length / totalLoanCount) * 1000) / 10 : 0;

  return {
    totalLoanCount,
    activeLoanCount: activeLoans.length,
    pendingReviewCount: pendingReview.length,
    totalDisbursedVolume,
    totalOutstandingBalance,
    totalCollections,
    delinquencyRate,
  };
}

/**
 * Creates the appropriate approved loan record and repayment schedule when application is approved.
 * IMPORTANT: Status is set to PENDING_DISBURSEMENT. It is NOT marked as ACTIVE until disbursement!
 */
export async function createApprovedLoanRecord(
  app: LoanApplicationDTO,
  approvedAmount: number,
  approvedTermMonths: number,
  approvedInterestRate: number,
  actor: { userId: string; role: string; firstName: string; lastName: string },
  notes?: string
): Promise<LoanDTO> {
  const products = await getLoanProducts();
  const product =
    products.find((p) => p.id === app.loanProductId) ||
    app.loanProduct ||
    products[0];

  const now = new Date();
  const seq = Math.floor(1000 + Math.random() * 9000);
  const loanNumber = `LN-2026-${seq}`;
  const loanId = `loan-${Date.now()}-${seq}`;

  const calcResult = calculateLoan({
    principal: approvedAmount,
    annualRate: approvedInterestRate,
    termMonths: approvedTermMonths,
    interestCalculationMethod: product.interestCalculationMethod as any,
    repaymentFrequency: app.repaymentFrequency as any,
    processingFeeType: product.processingFeeType,
    processingFeeValue: product.processingFeeValue,
    insuranceFeeType: product.insuranceFeeType,
    insuranceFeeValue: product.insuranceFeeValue,
    startDate: now.toISOString().split('T')[0],
  });

  const maturityDate =
    calcResult.schedule.length > 0
      ? calcResult.schedule[calcResult.schedule.length - 1].dueDate
      : new Date(now.getTime() + approvedTermMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const createdPrismaLoan = await prisma.$transaction(async (tx) => {
        // Create loan with status PENDING_DISBURSEMENT
        const newLoan = await tx.loan.create({
          data: {
            id: loanId,
            loanNumber,
            customerId: app.customerId,
            applicationId: app.id,
            loanProductId: app.loanProductId,
            branchId: app.branchId || 'br-dar-01',
            principalAmount: approvedAmount,
            interestRate: approvedInterestRate / 100,
            termMonths: approvedTermMonths,
            repaymentFrequency: app.repaymentFrequency as any,
            totalInterestExpected: calcResult.totalInterest,
            totalFeesExpected: calcResult.totalFees,
            totalAmountExpected: calcResult.totalPayable,
            outstandingPrincipal: approvedAmount,
            outstandingInterest: calcResult.totalInterest,
            outstandingFees: calcResult.totalFees,
            totalOutstandingBalance: calcResult.totalPayable,
            monthlyInstallment: calcResult.installmentAmount,
            status: 'PENDING_DISBURSEMENT',
            approvalDate: now,
            maturityDate: new Date(maturityDate),
            repaymentSchedules: {
              create: calcResult.schedule.map((s) => ({
                installmentNumber: s.installmentNumber,
                dueDate: new Date(s.dueDate),
                principalDue: s.principalDue,
                interestDue: s.interestDue,
                feesDue: s.feesDue,
                penaltyDue: 0,
                totalDue: s.totalDue,
                outstandingAmount: s.totalDue,
                status: 'SCHEDULED',
              })),
            },
          },
        });

        // Update application
        await tx.loanApplication.update({
          where: { id: app.id },
          data: {
            status: 'APPROVED',
            approvedAmount,
            approvedTermMonths,
            approvedInterestRate: approvedInterestRate / 100,
            approvalDate: now,
            approvedByStaffId: actor.userId,
            approvalNotes: notes || 'Facility approved by authorized credit committee.',
          },
        });

        return newLoan;
      });

      await recordAuditLog({
        userId: actor.userId,
        action: 'LOAN_APPROVED_RECORD_CREATED',
        resource: 'Loan',
        resourceId: createdPrismaLoan.id,
        details: {
          loanNumber,
          applicationNumber: app.applicationNumber,
          approvedAmount,
          approvedTermMonths,
          approvedInterestRate,
          monthlyInstallment: calcResult.installmentAmount,
          totalPayable: calcResult.totalPayable,
          maturityDate,
          status: 'PENDING_DISBURSEMENT',
        },
      });

      return getLoanById(createdPrismaLoan.id);
    } catch (err) {
      logger.error('Error creating approved loan in MySQL transaction:', err);
    }
  }

  // Memory fallback
  const scheduleDTOs = calcResult.schedule.map((s) => ({
    id: `sched-${loanId}-${s.installmentNumber}`,
    installmentNumber: s.installmentNumber,
    dueDate: s.dueDate,
    principalDue: s.principalDue,
    interestDue: s.interestDue,
    feesDue: s.feesDue,
    penaltyDue: 0,
    totalDue: s.totalDue,
    principalPaid: 0,
    interestPaid: 0,
    totalPaid: 0,
    amountPaid: 0,
    outstandingAmount: s.totalDue,
    status: 'SCHEDULED' as PaymentStatus,
    paidDate: null,
  }));

  const newLoanDTO: LoanDTO = {
    id: loanId,
    loanNumber,
    customerId: app.customerId,
    customer: app.customer,
    borrowerId: app.customerId,
    borrower: app.customer
      ? {
          id: app.customer.id,
          email: app.customer.email,
          firstName: app.customer.firstName,
          lastName: app.customer.lastName,
          phoneNumber: app.customer.phone,
        }
      : undefined,
    productId: product.id,
    product,
    principalAmount: approvedAmount,
    interestRate: approvedInterestRate,
    termMonths: approvedTermMonths,
    repaymentFrequency: app.repaymentFrequency as RepaymentFrequency,
    totalInterest: calcResult.totalInterest,
    totalPayable: calcResult.totalPayable,
    monthlyInstallment: calcResult.installmentAmount,
    remainingBalance: calcResult.totalPayable,
    totalPaidAmount: 0,
    status: 'PENDING_DISBURSEMENT', // Must NOT be active until disbursed!
    purpose: app.purpose,
    notes: notes || null,
    applicationDate: app.applicationDate || now.toISOString(),
    approvedAt: now.toISOString(),
    disbursedAt: null,
    maturityDate,
    reviewerId: actor.userId,
    reviewer: {
      id: actor.userId,
      firstName: actor.firstName,
      lastName: actor.lastName,
    },
    reviewNotes: notes || 'Facility approved by credit committee',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    repayments: scheduleDTOs,
    payments: [],
    disbursements: [],
  };

  memoryLoans.unshift(newLoanDTO);

  await recordAuditLog({
    userId: actor.userId,
    action: 'LOAN_APPROVED_RECORD_CREATED',
    resource: 'Loan',
    resourceId: newLoanDTO.id,
    details: {
      loanNumber,
      applicationNumber: app.applicationNumber,
      approvedAmount,
      approvedTermMonths,
      approvedInterestRate,
      monthlyInstallment: calcResult.installmentAmount,
      totalPayable: calcResult.totalPayable,
      maturityDate,
      status: 'PENDING_DISBURSEMENT',
    },
  });

  return newLoanDTO;
}

/**
 * Records disbursement of loan capital using database transaction.
 * Only after disbursement is successfully recorded is the loan marked as ACTIVE.
 */
export async function disburseLoanFacility(
  loanId: string,
  actor: { userId: string; role: string; firstName: string; lastName: string },
  input: DisburseLoanInput
): Promise<{ loan: LoanDTO; disbursement: LoanDisbursementDTO }> {
  const loan = await getLoanById(loanId);

  if (loan.status === 'ACTIVE') {
    throw AppError.badRequest(`Loan ${loan.loanNumber} has already been disbursed and is currently ACTIVE.`);
  }

  if (loan.status !== 'PENDING_DISBURSEMENT' && (loan.status as string) !== 'APPROVED') {
    throw AppError.badRequest(
      `Loan must be in PENDING_DISBURSEMENT status before disbursement. Current status: ${loan.status}`
    );
  }

  const actorRole = actor.role;
  const isAuthorized = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'].includes(actorRole);
  if (!isAuthorized) {
    throw AppError.forbidden(
      `Role ${actorRole} does not have disbursement release authority. Required: Cashier, Branch Manager, or Admin.`
    );
  }

  const now = input.disbursementDate ? new Date(input.disbursementDate) : new Date();
  const disbId = `disb-${Date.now()}`;
  const disbRef = input.disbursementReference.trim();
  const amount = input.amount || loan.principalAmount;

  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create disbursement record
        const disbRecord = await tx.loanDisbursement.create({
          data: {
            id: disbId,
            disbursementReference: disbRef,
            loanId: loan.id,
            amount,
            disbursementDate: now,
            paymentMethod: input.paymentMethod as any,
            channelDetails: input.channelDetails || undefined,
            destinationAccount: input.destinationAccount || undefined,
            disbursedByStaffId: actor.userId,
            status: 'PROCESSED',
            notes: input.notes || undefined,
          },
        });

        // 2. Mark loan as ACTIVE
        const updatedLoanRecord = await tx.loan.update({
          where: { id: loan.id },
          data: {
            status: 'ACTIVE',
            disbursementDate: now,
            outstandingPrincipal: amount,
            outstandingInterest: loan.totalInterest,
            totalOutstandingBalance: loan.totalPayable,
          },
        });

        // 3. Update application if linked
        const currentLoan = await tx.loan.findUnique({
          where: { id: loan.id },
          select: { applicationId: true },
        });

        if (currentLoan?.applicationId) {
          await tx.loanApplication.update({
            where: { id: currentLoan.applicationId },
            data: {
              status: 'DISBURSED' as any,
              disbursedAmount: amount,
              disbursedAt: now,
              disbursementReference: disbRef,
            },
          });
        }

        return { disbRecord, updatedLoanRecord };
      });

      await recordAuditLog({
        userId: actor.userId,
        action: 'LOAN_DISBURSEMENT_RECORDED',
        resource: 'Loan',
        resourceId: loan.id,
        details: {
          disbursementReference: disbRef,
          amount,
          method: input.paymentMethod,
          transactionReference: input.transactionReference,
          disbursedBy: `${actor.firstName} ${actor.lastName}`,
          loanNumber: loan.loanNumber,
          activatedAt: now.toISOString(),
        },
      });

      const updatedLoan = await getLoanById(loan.id);
      const disbursementDTO: LoanDisbursementDTO = {
        id: result.disbRecord.id,
        disbursementReference: result.disbRecord.disbursementReference,
        loanId: loan.id,
        amount: Number(result.disbRecord.amount),
        disbursementDate: result.disbRecord.disbursementDate.toISOString(),
        paymentMethod: result.disbRecord.paymentMethod as PaymentMethod,
        transactionReference: input.transactionReference,
        channelDetails: result.disbRecord.channelDetails,
        destinationAccount: result.disbRecord.destinationAccount,
        disbursedByStaffId: actor.userId,
        disbursedByStaffName: `${actor.firstName} ${actor.lastName}`.trim(),
        notes: result.disbRecord.notes,
        status: result.disbRecord.status,
      };

      return { loan: updatedLoan, disbursement: disbursementDTO };
    } catch (err) {
      logger.error('Error recording disbursement in MySQL transaction:', err);
    }
  }

  // Memory fallback
  const loanIndex = memoryLoans.findIndex((l) => l.id === loanId);
  if (loanIndex === -1) throw AppError.notFound('Loan');

  const disbursementDTO: LoanDisbursementDTO = {
    id: disbId,
    disbursementReference: disbRef,
    loanId: loan.id,
    amount,
    disbursementDate: now.toISOString(),
    paymentMethod: input.paymentMethod,
    transactionReference: input.transactionReference,
    channelDetails: input.channelDetails || 'Treasury Commercial Clearing Channel',
    destinationAccount: input.destinationAccount || 'Settlement Account On File',
    disbursedByStaffId: actor.userId,
    disbursedByStaffName: `${actor.firstName} ${actor.lastName}`.trim(),
    notes: input.notes || null,
    status: 'PROCESSED',
  };

  const updatedLoan: LoanDTO = {
    ...memoryLoans[loanIndex],
    status: 'ACTIVE', // Only NOW marked as active!
    disbursedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    disbursements: [disbursementDTO, ...(memoryLoans[loanIndex].disbursements || [])],
  };

  memoryLoans[loanIndex] = updatedLoan;

  await recordAuditLog({
    userId: actor.userId,
    action: 'LOAN_DISBURSEMENT_RECORDED',
    resource: 'Loan',
    resourceId: loan.id,
    details: {
      disbursementReference: disbRef,
      amount,
      method: input.paymentMethod,
      transactionReference: input.transactionReference,
      disbursedBy: `${actor.firstName} ${actor.lastName}`,
      loanNumber: loan.loanNumber,
      activatedAt: now.toISOString(),
    },
  });

  dispatchNotification({
    eventType: 'LOAN_DISBURSED',
    recipientUserId: loan.customerId,
    recipientCustomerId: loan.customerId,
    templateData: {
      loanNumber: loan.loanNumber,
      customerName: loan.customer ? `${loan.customer.firstName} ${loan.customer.lastName}` : (loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : 'Valued Client'),
      customerFirstName: loan.customer?.firstName || loan.borrower?.firstName || 'Client',
      amount,
      disbursementMethod: input.paymentMethod,
      transactionReference: input.transactionReference || disbRef,
      firstDueDate: loan.repayments?.[0]?.dueDate || 'Within 30 days',
      monthlyInstallment: loan.monthlyInstallment || 0,
      phone: loan.customer?.phone || loan.borrower?.phoneNumber,
      email: loan.customer?.email || loan.borrower?.email,
    },
  }).catch((err) => logger.warn('Failed to dispatch loan disbursed notification:', err));

  return { loan: updatedLoan, disbursement: disbursementDTO };
}

/**
 * Returns previous loans, active loans, and total outstanding debt obligations for a customer.
 */
export async function getCustomerLoanSummary(customerId: string): Promise<CustomerLoanSummaryDTO> {
  const allLoans = await getAllLoans({ customerId });

  const activeLoans = allLoans.filter((l) =>
    ['ACTIVE', 'PENDING_DISBURSEMENT', 'IN_ARREARS', 'DELINQUENT'].includes(l.status)
  );

  const previousLoans = allLoans.filter((l) =>
    ['CLOSED', 'CLOSED_PAID_OFF', 'COMPLETED', 'RESTRUCTURED', 'WRITTEN_OFF'].includes(l.status)
  );

  const totalOutstandingBalance = activeLoans.reduce((sum, l) => sum + (l.remainingBalance || 0), 0);
  const totalOutstandingPrincipal = activeLoans.reduce((sum, l) => sum + (l.principalAmount || 0), 0);
  const totalMonthlyDebtObligation = activeLoans.reduce((sum, l) => sum + (l.monthlyInstallment || 0), 0);

  return {
    customerId,
    previousLoans,
    activeLoans,
    totalLoansCount: allLoans.length,
    activeLoansCount: activeLoans.length,
    totalOutstandingBalance,
    totalOutstandingPrincipal,
    totalMonthlyDebtObligation,
  };
}
