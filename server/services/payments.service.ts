import { prisma, isDatabaseConnected } from '../db/prisma.js';
import {
  PaymentTransactionDTO,
  PaymentMethod,
  PaymentAllocationDTO,
  PaymentReceiptDTO,
  RepaymentScheduleDTO,
  AllocationStrategy,
  AllocationComponent,
  OverpaymentRule,
  LoanDTO,
  PaymentStatus,
  LoanStatus,
} from '../../shared/types/index.js';
import { CreatePaymentInput } from '../../shared/validators/payment.js';
import { AppError } from '../middleware/errorHandler.js';
import { recordAuditLog } from './audit.service.js';
import { dispatchNotification } from './notification.service.js';
import { logger } from '../utils/logger.js';
import { getLoanById, memoryLoans } from './loans.service.js';

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function getPriorityComponents(
  strategy: AllocationStrategy,
  customOrder?: AllocationComponent[]
): AllocationComponent[] {
  if (strategy === 'CUSTOM' && customOrder && customOrder.length > 0) {
    return customOrder;
  }
  switch (strategy) {
    case 'FEES_PENALTIES_INTEREST_PRINCIPAL':
      return ['FEES', 'PENALTIES', 'INTEREST', 'PRINCIPAL'];
    case 'INTEREST_FEES_PENALTIES_PRINCIPAL':
      return ['INTEREST', 'FEES', 'PENALTIES', 'PRINCIPAL'];
    case 'PRINCIPAL_FIRST':
      return ['PRINCIPAL', 'INTEREST', 'FEES', 'PENALTIES'];
    case 'PENALTIES_FEES_INTEREST_PRINCIPAL':
    default:
      return ['PENALTIES', 'FEES', 'INTEREST', 'PRINCIPAL'];
  }
}

export interface AllocationComputationResult {
  allocations: PaymentAllocationDTO[];
  totalPenaltiesAllocated: number;
  totalFeesAllocated: number;
  totalInterestAllocated: number;
  totalPrincipalAllocated: number;
  totalAllocated: number;
  overpaymentAmount: number;
  updatedSchedules: RepaymentScheduleDTO[];
  newOutstandingPrincipal: number;
  newOutstandingInterest: number;
  newOutstandingFees: number;
  newOutstandingPenalties: number;
  newTotalOutstandingBalance: number;
  previousBalance: number;
  loanStatus: LoanStatus;
}

/**
 * Pure calculation function for allocating payment amount across repayment schedules
 * based on configurable allocation priority and overpayment rules.
 */
export function computePaymentAllocation(
  loan: LoanDTO,
  amount: number,
  paymentDateStr: string,
  options?: {
    strategy?: AllocationStrategy;
    customPriority?: AllocationComponent[];
    overpaymentRule?: OverpaymentRule;
  }
): AllocationComputationResult {
  const strategy = options?.strategy || 'PENALTIES_FEES_INTEREST_PRINCIPAL';
  const priorityComponents = getPriorityComponents(strategy, options?.customPriority);
  const overpaymentRule = options?.overpaymentRule || 'APPLY_TO_NEXT_INSTALLMENTS';

  const paymentDate = new Date(paymentDateStr);
  let remainingToAllocate = round2(amount);

  // Clone repayment schedules to avoid unintended side effects
  const schedules: RepaymentScheduleDTO[] = (loan.repayments || []).map((s) => ({
    ...s,
    principalPaid: s.principalPaid || 0,
    interestPaid: s.interestPaid || 0,
    feesPaid: s.feesPaid || 0,
    penaltyPaid: s.penaltyPaid || 0,
    totalPaid: s.totalPaid || 0,
    outstandingAmount: s.outstandingAmount !== undefined ? s.outstandingAmount : s.totalDue,
  }));

  // Sort chronologically by installment number
  schedules.sort((a, b) => a.installmentNumber - b.installmentNumber);

  const allocations: PaymentAllocationDTO[] = [];
  let totalPenaltiesAllocated = 0;
  let totalFeesAllocated = 0;
  let totalInterestAllocated = 0;
  let totalPrincipalAllocated = 0;

  for (const item of schedules) {
    if (remainingToAllocate <= 0) break;

    // Check if this installment has any unpaid amounts
    const unpaidPenalty = Math.max(0, round2((item.penaltyDue || 0) - (item.penaltyPaid || 0)));
    const unpaidFees = Math.max(0, round2((item.feesDue || 0) - (item.feesPaid || 0)));
    const unpaidInterest = Math.max(0, round2((item.interestDue || 0) - (item.interestPaid || 0)));
    const unpaidPrincipal = Math.max(0, round2((item.principalDue || 0) - (item.principalPaid || 0)));

    const itemTotalUnpaid = round2(unpaidPenalty + unpaidFees + unpaidInterest + unpaidPrincipal);
    if (itemTotalUnpaid <= 0) continue;

    let installmentPenaltyAllocated = 0;
    let installmentFeesAllocated = 0;
    let installmentInterestAllocated = 0;
    let installmentPrincipalAllocated = 0;

    // Allocate according to priority components
    for (const comp of priorityComponents) {
      if (remainingToAllocate <= 0) break;

      if (comp === 'PENALTIES' && unpaidPenalty > 0) {
        const alloc = Math.min(remainingToAllocate, unpaidPenalty);
        installmentPenaltyAllocated += alloc;
        totalPenaltiesAllocated += alloc;
        remainingToAllocate = round2(remainingToAllocate - alloc);
      } else if (comp === 'FEES' && unpaidFees > 0) {
        const alloc = Math.min(remainingToAllocate, unpaidFees);
        installmentFeesAllocated += alloc;
        totalFeesAllocated += alloc;
        remainingToAllocate = round2(remainingToAllocate - alloc);
      } else if (comp === 'INTEREST' && unpaidInterest > 0) {
        const alloc = Math.min(remainingToAllocate, unpaidInterest);
        installmentInterestAllocated += alloc;
        totalInterestAllocated += alloc;
        remainingToAllocate = round2(remainingToAllocate - alloc);
      } else if (comp === 'PRINCIPAL' && unpaidPrincipal > 0) {
        const alloc = Math.min(remainingToAllocate, unpaidPrincipal);
        installmentPrincipalAllocated += alloc;
        totalPrincipalAllocated += alloc;
        remainingToAllocate = round2(remainingToAllocate - alloc);
      }
    }

    const installmentTotalAllocated = round2(
      installmentPenaltyAllocated +
        installmentFeesAllocated +
        installmentInterestAllocated +
        installmentPrincipalAllocated
    );

    if (installmentTotalAllocated > 0) {
      item.penaltyPaid = round2((item.penaltyPaid || 0) + installmentPenaltyAllocated);
      item.feesPaid = round2((item.feesPaid || 0) + installmentFeesAllocated);
      item.interestPaid = round2((item.interestPaid || 0) + installmentInterestAllocated);
      item.principalPaid = round2((item.principalPaid || 0) + installmentPrincipalAllocated);
      item.totalPaid = round2(
        item.penaltyPaid + item.feesPaid + item.interestPaid + item.principalPaid
      );

      item.outstandingAmount = Math.max(0, round2(item.totalDue - item.totalPaid));
      item.outstandingPrincipal = Math.max(0, round2(item.principalDue - item.principalPaid));
      item.outstandingInterest = Math.max(0, round2(item.interestDue - item.interestPaid));
      item.outstandingFees = Math.max(0, round2((item.feesDue || 0) - item.feesPaid));
      item.outstandingPenalty = Math.max(0, round2((item.penaltyDue || 0) - item.penaltyPaid));

      if (item.outstandingAmount <= 0) {
        item.status = 'PAID';
        item.paidDate = paymentDateStr;
      } else {
        item.status = 'PARTIALLY_PAID';
      }

      allocations.push({
        id: `alloc-${Date.now()}-${item.installmentNumber}`,
        paymentId: '',
        repaymentScheduleId: item.id,
        installmentNumber: item.installmentNumber,
        dueDate: item.dueDate,
        penaltyAllocated: installmentPenaltyAllocated,
        feesAllocated: installmentFeesAllocated,
        interestAllocated: installmentInterestAllocated,
        principalAllocated: installmentPrincipalAllocated,
        totalAllocated: installmentTotalAllocated,
        allocatedAt: paymentDateStr,
      });
    }
  }

  // Handle overpayment if remainingToAllocate > 0
  let overpaymentAmount = 0;
  if (remainingToAllocate > 0) {
    if (overpaymentRule === 'REDUCE_OUTSTANDING_PRINCIPAL') {
      // Apply remaining directly to any future principal schedules
      for (const item of schedules) {
        if (remainingToAllocate <= 0) break;
        const currentPrincipalUnpaid = Math.max(0, round2(item.principalDue - item.principalPaid));
        if (currentPrincipalUnpaid > 0) {
          const extraPrincipal = Math.min(remainingToAllocate, currentPrincipalUnpaid);
          item.principalPaid = round2(item.principalPaid + extraPrincipal);
          item.totalPaid = round2(item.totalPaid + extraPrincipal);
          item.outstandingAmount = Math.max(0, round2(item.totalDue - item.totalPaid));
          item.outstandingPrincipal = Math.max(0, round2(item.principalDue - item.principalPaid));
          totalPrincipalAllocated = round2(totalPrincipalAllocated + extraPrincipal);
          remainingToAllocate = round2(remainingToAllocate - extraPrincipal);

          if (item.outstandingAmount <= 0) {
            item.status = 'PAID';
            item.paidDate = paymentDateStr;
          }
        }
      }
      overpaymentAmount = remainingToAllocate;
    } else {
      // Overpayment holds as credit or excess pool
      overpaymentAmount = remainingToAllocate;
    }
  }

  const totalAllocated = round2(
    totalPenaltiesAllocated +
      totalFeesAllocated +
      totalInterestAllocated +
      totalPrincipalAllocated
  );

  // Recalculate remaining loan aggregate balances
  const newOutstandingPrincipal = Math.max(
    0,
    round2(schedules.reduce((sum, s) => sum + Math.max(0, s.principalDue - s.principalPaid), 0))
  );
  const newOutstandingInterest = Math.max(
    0,
    round2(schedules.reduce((sum, s) => sum + Math.max(0, s.interestDue - s.interestPaid), 0))
  );
  const newOutstandingFees = Math.max(
    0,
    round2(schedules.reduce((sum, s) => sum + Math.max(0, (s.feesDue || 0) - (s.feesPaid || 0)), 0))
  );
  const newOutstandingPenalties = Math.max(
    0,
    round2(schedules.reduce((sum, s) => sum + Math.max(0, (s.penaltyDue || 0) - (s.penaltyPaid || 0)), 0))
  );

  const previousBalance = loan.remainingBalance;
  const newTotalOutstandingBalance = Math.max(
    0,
    round2(
      newOutstandingPrincipal +
        newOutstandingInterest +
        newOutstandingFees +
        newOutstandingPenalties
    )
  );

  const loanStatus: LoanStatus =
    newTotalOutstandingBalance <= 0 ? 'CLOSED_PAID_OFF' : loan.status;

  return {
    allocations,
    totalPenaltiesAllocated: round2(totalPenaltiesAllocated),
    totalFeesAllocated: round2(totalFeesAllocated),
    totalInterestAllocated: round2(totalInterestAllocated),
    totalPrincipalAllocated: round2(totalPrincipalAllocated),
    totalAllocated,
    overpaymentAmount: round2(overpaymentAmount),
    updatedSchedules: schedules,
    newOutstandingPrincipal,
    newOutstandingInterest,
    newOutstandingFees,
    newOutstandingPenalties,
    newTotalOutstandingBalance,
    previousBalance,
    loanStatus,
  };
}

// Global In-Memory Store
const DEMO_PAYMENTS: PaymentTransactionDTO[] = [
  {
    id: 'pay-001',
    paymentReference: 'PAY-2026-0001',
    transactionRef: 'TXN-BANK-998231',
    receiptNumber: 'RCP-2026-001',
    loanId: 'loan-sme-0042',
    loanNumber: 'LN-2026-0042',
    customerId: 'cust-01',
    customerName: 'Alexander Hayes',
    customerNumber: 'CUST-2026-0001',
    amount: 1475.25,
    paymentDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    method: 'BANK_TRANSFER',
    status: 'FULLY_ALLOCATED',
    allocationStrategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
    principalAllocated: 1250.0,
    interestAllocated: 225.25,
    feesAllocated: 0,
    penaltyAllocated: 0,
    overpaymentAmount: 0,
    notes: 'Monthly ACH installment direct settlement',
    receivedBy: {
      id: 'staff-csh-01',
      firstName: 'Chloe',
      lastName: 'Bennett',
      role: 'CASHIER',
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay-002',
    paymentReference: 'PAY-2026-0002',
    transactionRef: 'TXN-WIRE-441029',
    receiptNumber: 'RCP-2026-002',
    loanId: 'loan-sme-0042',
    loanNumber: 'LN-2026-0042',
    customerId: 'cust-01',
    customerName: 'Alexander Hayes',
    customerNumber: 'CUST-2026-0001',
    amount: 2890.5,
    paymentDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    method: 'BANK_TRANSFER',
    status: 'FULLY_ALLOCATED',
    allocationStrategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
    principalAllocated: 2500.0,
    interestAllocated: 390.5,
    feesAllocated: 0,
    penaltyAllocated: 0,
    overpaymentAmount: 0,
    notes: 'Commercial working capital installment',
    receivedBy: {
      id: 'staff-csh-01',
      firstName: 'Chloe',
      lastName: 'Bennett',
      role: 'CASHIER',
    },
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'pay-003',
    paymentReference: 'PAY-2026-0003',
    transactionRef: 'TXN-MM-883100',
    receiptNumber: 'RCP-2026-003',
    loanId: 'loan-sme-0042',
    loanNumber: 'LN-2026-0042',
    customerId: 'cust-01',
    customerName: 'Alexander Hayes',
    customerNumber: 'CUST-2026-0001',
    amount: 1475.25,
    paymentDate: new Date().toISOString(),
    method: 'MOBILE_MONEY',
    status: 'FULLY_ALLOCATED',
    allocationStrategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
    principalAllocated: 1250.0,
    interestAllocated: 225.25,
    feesAllocated: 0,
    penaltyAllocated: 0,
    overpaymentAmount: 0,
    notes: 'Counter terminal transaction',
    receivedBy: {
      id: 'staff-csh-01',
      firstName: 'Chloe',
      lastName: 'Bennett',
      role: 'CASHIER',
    },
    createdAt: new Date().toISOString(),
  },
];

export const activeMemoryPayments: PaymentTransactionDTO[] = [...DEMO_PAYMENTS];

export async function getAllPayments(query?: {
  loanId?: string;
  customerId?: string;
  search?: string;
}): Promise<PaymentTransactionDTO[]> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const whereClause: any = {};
      if (query?.loanId) whereClause.loanId = query.loanId;
      if (query?.customerId) whereClause.customerId = query.customerId;

      const payments = await prisma.payment.findMany({
        where: whereClause,
        include: {
          receivedByStaff: true,
          loan: { include: { customer: true, loanProduct: true } },
          allocations: true,
        },
        orderBy: { paymentDate: 'desc' },
      });

      return payments.map((p) => {
        const totalP = p.allocations.reduce((sum, a) => sum + Number(a.principalAllocated), 0);
        const totalI = p.allocations.reduce((sum, a) => sum + Number(a.interestAllocated), 0);
        const totalF = p.allocations.reduce((sum, a) => sum + Number(a.feesAllocated), 0);
        const totalPen = p.allocations.reduce((sum, a) => sum + Number(a.penaltyAllocated), 0);

        return {
          id: p.id,
          paymentReference: p.paymentReference,
          transactionRef: p.transactionReference || p.paymentReference,
          receiptNumber: p.receiptNumber,
          loanId: p.loanId,
          loanNumber: p.loan?.loanNumber,
          customerId: p.customerId,
          customerName: p.loan?.customer
            ? `${p.loan.customer.firstName} ${p.loan.customer.lastName}`
            : undefined,
          customerNumber: p.loan?.customer?.customerNumber,
          amount: Number(p.amount),
          paymentDate: p.paymentDate.toISOString(),
          method: p.paymentMethod as PaymentMethod,
          status: p.allocationStatus as any,
          principalAllocated: totalP,
          interestAllocated: totalI,
          feesAllocated: totalF,
          penaltyAllocated: totalPen,
          notes: p.notes,
          receivedBy: p.receivedByStaff
            ? {
                id: p.receivedByStaff.id,
                firstName: p.receivedByStaff.firstName,
                lastName: p.receivedByStaff.lastName,
                role: p.receivedByStaff.designation || 'Staff',
              }
            : null,
          createdAt: p.createdAt.toISOString(),
        };
      });
    } catch (err) {
      logger.error('Error fetching payments from database:', err);
    }
  }

  // In-memory fallback
  let result = [...activeMemoryPayments];
  if (query?.loanId) {
    result = result.filter((p) => p.loanId === query.loanId);
  }
  if (query?.customerId) {
    result = result.filter((p) => p.customerId === query.customerId);
  }
  if (query?.search?.trim()) {
    const q = query.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.transactionRef?.toLowerCase().includes(q) ||
        p.paymentReference?.toLowerCase().includes(q) ||
        p.receiptNumber?.toLowerCase().includes(q) ||
        p.loanNumber?.toLowerCase().includes(q) ||
        p.customerName?.toLowerCase().includes(q)
    );
  }
  return result;
}

export async function getPaymentById(id: string): Promise<PaymentTransactionDTO> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const p = await prisma.payment.findUnique({
        where: { id },
        include: {
          receivedByStaff: true,
          loan: { include: { customer: true, loanProduct: true } },
          allocations: true,
        },
      });
      if (p) {
        return {
          id: p.id,
          paymentReference: p.paymentReference,
          transactionRef: p.transactionReference || p.paymentReference,
          receiptNumber: p.receiptNumber,
          loanId: p.loanId,
          loanNumber: p.loan?.loanNumber,
          customerId: p.customerId,
          customerName: p.loan?.customer
            ? `${p.loan.customer.firstName} ${p.loan.customer.lastName}`
            : undefined,
          amount: Number(p.amount),
          paymentDate: p.paymentDate.toISOString(),
          method: p.paymentMethod as PaymentMethod,
          status: p.allocationStatus as any,
          notes: p.notes,
          receivedBy: p.receivedByStaff
            ? {
                id: p.receivedByStaff.id,
                firstName: p.receivedByStaff.firstName,
                lastName: p.receivedByStaff.lastName,
                role: p.receivedByStaff.designation || 'Staff',
              }
            : null,
          createdAt: p.createdAt.toISOString(),
        };
      }
    } catch (err) {
      logger.error('Error fetching payment by id:', err);
    }
  }

  const p = activeMemoryPayments.find((pay) => pay.id === id || pay.paymentReference === id);
  if (!p) throw AppError.notFound(`Payment transaction "${id}" not found.`);
  return p;
}

/**
 * Preview calculation without committing.
 * Allows UI to display live breakdown of where every cent goes.
 */
export async function previewPaymentAllocation(
  loanId: string,
  amount: number,
  options?: {
    strategy?: AllocationStrategy;
    customPriority?: AllocationComponent[];
    overpaymentRule?: OverpaymentRule;
    paymentDate?: string;
  }
): Promise<AllocationComputationResult> {
  const loan = await getLoanById(loanId);
  const paymentDateStr = options?.paymentDate || new Date().toISOString();
  return computePaymentAllocation(loan, amount, paymentDateStr, options);
}

/**
 * Executes a payment with full allocation priority, updates loan & installment statuses,
 * generates an official receipt, ensures auditability, and uses database transactions.
 */
export async function createPayment(
  input: CreatePaymentInput,
  actor: { userId: string; firstName?: string; lastName?: string; role?: string }
): Promise<PaymentTransactionDTO> {
  const loan = await getLoanById(input.loanId);
  const now = new Date();
  const paymentDateStr = input.paymentDate || now.toISOString();
  const method = (input.paymentMethod || 'BANK_TRANSFER') as PaymentMethod;
  const strategy = input.allocationStrategy || 'PENALTIES_FEES_INTEREST_PRINCIPAL';
  const overpaymentRule = input.overpaymentRule || 'APPLY_TO_NEXT_INSTALLMENTS';

  if (input.paymentReference) {
    const trimmedRef = input.paymentReference.trim();
    const isConn = await isDatabaseConnected();
    if (isConn) {
      const dup = await prisma.payment.findFirst({ where: { paymentReference: trimmedRef } });
      if (dup) throw AppError.conflict(`Duplicate payment reference: ${trimmedRef} already recorded.`);
    } else {
      const dup = activeMemoryPayments.find((p) => p.paymentReference === trimmedRef);
      if (dup) throw AppError.conflict(`Duplicate payment reference: ${trimmedRef} already recorded.`);
    }
  }

  const payRef =
    input.paymentReference?.trim() ||
    `PAY-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  const txnRef =
    input.transactionReference?.trim() ||
    `TXN-${method}-${Date.now().toString().slice(-6)}`;
  const receiptNum = `RCP-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

  // Run allocation logic
  const allocResult = computePaymentAllocation(loan, input.amount, paymentDateStr, {
    strategy,
    customPriority: input.customAllocationPriority,
    overpaymentRule,
  });

  const nextDue = allocResult.updatedSchedules.find((s) => s.outstandingAmount > 0);

  const receipt: PaymentReceiptDTO = {
    receiptNumber: receiptNum,
    paymentReference: payRef,
    transactionReference: txnRef,
    paymentDate: paymentDateStr,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    productName: loan.product?.name || 'Commercial Credit Line',
    customerId: loan.customerId,
    customerName:
      loan.customer ? `${loan.customer.firstName} ${loan.customer.lastName}`.trim() : 'Valued Client',
    customerNumber: loan.customer?.customerNumber,
    customerPhone: loan.customer?.phone,
    amountPaid: input.amount,
    currency: 'TZS',
    paymentMethod: method,
    allocation: {
      penalties: allocResult.totalPenaltiesAllocated,
      fees: allocResult.totalFeesAllocated,
      interest: allocResult.totalInterestAllocated,
      principal: allocResult.totalPrincipalAllocated,
      overpayment: allocResult.overpaymentAmount,
    },
    allocationStrategy: strategy,
    overpaymentRule,
    previousBalance: allocResult.previousBalance,
    newBalance: allocResult.newTotalOutstandingBalance,
    remainingPrincipal: allocResult.newOutstandingPrincipal,
    remainingInterest: allocResult.newOutstandingInterest,
    remainingFees: allocResult.newOutstandingFees,
    remainingPenalties: allocResult.newOutstandingPenalties,
    nextInstallment: nextDue
      ? {
          installmentNumber: nextDue.installmentNumber,
          dueDate: nextDue.dueDate,
          amountDue: nextDue.outstandingAmount,
        }
      : null,
    receivedByStaffName:
      `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || 'Authorized Cashier',
    receivedByStaffRole: actor.role || 'CASHIER',
    notes: input.notes || null,
    isReversal: false,
    issuedAt: now.toISOString(),
  };

  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Create immutable Payment record
        const paymentRecord = await tx.payment.create({
          data: {
            paymentReference: payRef,
            receiptNumber: receiptNum,
            customerId: loan.customerId,
            loanId: loan.id,
            amount: input.amount,
            paymentMethod: input.paymentMethod as any,
            transactionReference: txnRef,
            paymentDate: new Date(paymentDateStr),
            receivedByStaffId: actor.userId,
            allocationStatus: 'FULLY_ALLOCATED',
            notes: input.notes || 'Repayment settlement',
          },
        });

        // 2. Persist individual item allocations
        for (const alloc of allocResult.allocations) {
          if (alloc.repaymentScheduleId) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: paymentRecord.id,
                repaymentScheduleId: alloc.repaymentScheduleId,
                principalAllocated: alloc.principalAllocated,
                interestAllocated: alloc.interestAllocated,
                feesAllocated: alloc.feesAllocated,
                penaltyAllocated: alloc.penaltyAllocated,
                totalAllocated: alloc.totalAllocated,
                allocatedAt: new Date(paymentDateStr),
              },
            });
          }
        }

        // 3. Update repayment schedules
        for (const s of allocResult.updatedSchedules) {
          await tx.repaymentSchedule.update({
            where: { id: s.id },
            data: {
              principalPaid: s.principalPaid,
              interestPaid: s.interestPaid,
              feesPaid: s.feesPaid,
              penaltyPaid: s.penaltyPaid,
              totalPaid: s.totalPaid,
              outstandingAmount: s.outstandingAmount,
              status: s.status as any,
              paidDate: s.paidDate ? new Date(s.paidDate) : null,
            },
          });
        }

        // 4. Update Loan aggregate balance
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            totalPaidAmount: { increment: input.amount },
            totalPaidPrincipal: { increment: allocResult.totalPrincipalAllocated },
            totalPaidInterest: { increment: allocResult.totalInterestAllocated },
            totalPaidFees: { increment: allocResult.totalFeesAllocated },
            totalPaidPenalties: { increment: allocResult.totalPenaltiesAllocated },
            outstandingPrincipal: allocResult.newOutstandingPrincipal,
            outstandingInterest: allocResult.newOutstandingInterest,
            outstandingFees: allocResult.newOutstandingFees,
            outstandingPenalties: allocResult.newOutstandingPenalties,
            totalOutstandingBalance: allocResult.newTotalOutstandingBalance,
            status: allocResult.loanStatus as any,
            closedDate: allocResult.loanStatus === 'CLOSED_PAID_OFF' ? now : undefined,
          },
        });
      });
    } catch (err) {
      logger.error('Error recording payment in MySQL transaction:', err);
    }
  }

  // Update in-memory state
  const loanIndex = memoryLoans.findIndex((l) => l.id === loan.id);
  if (loanIndex !== -1) {
    const memLoan = memoryLoans[loanIndex];
    memLoan.repayments = allocResult.updatedSchedules;
    memLoan.remainingBalance = allocResult.newTotalOutstandingBalance;
    memLoan.totalPaidAmount = round2((memLoan.totalPaidAmount || 0) + input.amount);
    memLoan.status = allocResult.loanStatus;
    if (allocResult.loanStatus === 'CLOSED_PAID_OFF') {
      memLoan.closedAt = now.toISOString();
    }
  }

  const transactionRecord: PaymentTransactionDTO = {
    id: `pay-${Date.now()}`,
    paymentReference: payRef,
    transactionRef: txnRef,
    receiptNumber: receiptNum,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    customerId: loan.customerId,
    customerName: receipt.customerName,
    customerNumber: receipt.customerNumber,
    amount: input.amount,
    paymentDate: paymentDateStr,
    method,
    status: 'FULLY_ALLOCATED',
    allocationStrategy: strategy,
    overpaymentRule,
    penaltyAllocated: allocResult.totalPenaltiesAllocated,
    feesAllocated: allocResult.totalFeesAllocated,
    interestAllocated: allocResult.totalInterestAllocated,
    principalAllocated: allocResult.totalPrincipalAllocated,
    overpaymentAmount: allocResult.overpaymentAmount,
    allocations: allocResult.allocations,
    receipt,
    notes: input.notes || null,
    isReversal: false,
    receivedBy: {
      id: actor.userId,
      firstName: actor.firstName || 'Staff',
      lastName: actor.lastName || 'Cashier',
      role: actor.role || 'CASHIER',
    },
    createdAt: now.toISOString(),
  };

  // Add to active payments
  activeMemoryPayments.unshift(transactionRecord);

  // Link to loan's payment history
  if (loanIndex !== -1) {
    memoryLoans[loanIndex].payments = [
      transactionRecord,
      ...(memoryLoans[loanIndex].payments || []),
    ];
  }

  // Audit Logging
  await recordAuditLog({
    userId: actor.userId,
    action: 'PAYMENT_RECORDED',
    resource: 'Payment',
    resourceId: transactionRecord.id,
    details: {
      loanNumber: loan.loanNumber,
      amount: input.amount,
      method: input.paymentMethod,
      payRef,
      receiptNumber: receiptNum,
      allocation: {
        penalties: allocResult.totalPenaltiesAllocated,
        fees: allocResult.totalFeesAllocated,
        interest: allocResult.totalInterestAllocated,
        principal: allocResult.totalPrincipalAllocated,
        overpayment: allocResult.overpaymentAmount,
      },
      strategy: input.allocationStrategy,
      previousBalance: allocResult.previousBalance,
      newBalance: allocResult.newTotalOutstandingBalance,
    },
  });

  dispatchNotification({
    eventType: 'PAYMENT_RECEIVED',
    recipientUserId: loan.customerId,
    recipientCustomerId: loan.customerId,
    templateData: {
      receiptNumber: receiptNum,
      amountPaid: input.amount,
      loanNumber: loan.loanNumber,
      customerName: loan.customer ? `${loan.customer.firstName} ${loan.customer.lastName}` : (loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : 'Valued Client'),
      customerFirstName: loan.customer?.firstName || loan.borrower?.firstName || 'Client',
      paymentMethod: input.paymentMethod,
      principalAllocated: allocResult.totalPrincipalAllocated,
      interestAllocated: allocResult.totalInterestAllocated,
      remainingBalance: allocResult.newTotalOutstandingBalance,
      phone: loan.customer?.phone || loan.borrower?.phoneNumber,
      email: loan.customer?.email || loan.borrower?.email,
    },
  }).catch((err) => logger.warn('Failed to dispatch payment received notification:', err));

  if (allocResult.newTotalOutstandingBalance <= 0) {
    dispatchNotification({
      eventType: 'LOAN_COMPLETED',
      recipientUserId: loan.customerId,
      recipientCustomerId: loan.customerId,
      templateData: {
        loanNumber: loan.loanNumber,
        customerName: loan.customer ? `${loan.customer.firstName} ${loan.customer.lastName}` : (loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : 'Valued Client'),
        customerFirstName: loan.customer?.firstName || loan.borrower?.firstName || 'Client',
        totalPaidAmount: loan.totalPaidAmount + input.amount,
        termMonths: loan.termMonths || 12,
        phone: loan.customer?.phone || loan.borrower?.phoneNumber,
        email: loan.customer?.email || loan.borrower?.email,
      },
    }).catch((err) => logger.warn('Failed to dispatch loan completed notification:', err));
  }

  return transactionRecord;
}

/**
 * Reverses a payment by creating an immutable companion reversal transaction record
 * and restoring loan and installment balances without deleting financial history.
 */
export async function reversePayment(
  paymentId: string,
  reason: string,
  actor: { userId: string; firstName?: string; lastName?: string; role?: string }
): Promise<{ originalPayment: PaymentTransactionDTO; reversalTransaction: PaymentTransactionDTO }> {
  if (!reason || reason.trim().length < 5) {
    throw AppError.badRequest('A detailed reversal reason (at least 5 characters) is strictly required.');
  }

  const payment = activeMemoryPayments.find(
    (p) => p.id === paymentId || p.paymentReference === paymentId || p.receiptNumber === paymentId
  );
  if (!payment) {
    throw AppError.notFound(`Payment transaction "${paymentId}" was not found.`);
  }

  if (payment.status === 'REVERSED') {
    throw AppError.badRequest(`Payment transaction "${payment.paymentReference || payment.id}" has already been reversed.`);
  }

  const loan = await getLoanById(payment.loanId);
  const now = new Date();

  // 1. Mark original payment as REVERSED
  payment.status = 'REVERSED';
  payment.reversalReason = reason.trim();
  payment.reversedAt = now.toISOString();
  payment.reversedByStaffId = actor.userId;
  payment.reversedByStaffName = `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || 'Staff Officer';
  payment.notes = `${payment.notes || ''} [REVERSED on ${now.toISOString().split('T')[0]}: ${reason.trim()}]`.trim();

  // 2. Create companion REVERSAL transaction record (preserves audit trail)
  const reversalRef = `REV-${Date.now().toString().slice(-6)}`;
  const reversalReceiptNum = `RCP-REV-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

  const reversalTransaction: PaymentTransactionDTO = {
    id: `rev-${Date.now()}`,
    paymentReference: reversalRef,
    transactionRef: `REV-TXN-${payment.transactionRef}`,
    receiptNumber: reversalReceiptNum,
    loanId: payment.loanId,
    loanNumber: payment.loanNumber,
    customerId: payment.customerId,
    customerName: payment.customerName,
    customerNumber: payment.customerNumber,
    amount: -payment.amount, // Negated amount for accounting ledger balance
    paymentDate: now.toISOString(),
    method: payment.method,
    status: 'REVERSED',
    isReversal: true,
    reversedPaymentId: payment.id,
    reversalReason: reason.trim(),
    reversedAt: now.toISOString(),
    reversedByStaffId: actor.userId,
    reversedByStaffName: payment.reversedByStaffName,
    notes: `Accounting reversal for payment ref ${payment.paymentReference || payment.id}. Reason: ${reason.trim()}`,
    receivedBy: {
      id: actor.userId,
      firstName: actor.firstName || 'Staff',
      lastName: actor.lastName || 'Officer',
      role: actor.role || 'CASHIER',
    },
    createdAt: now.toISOString(),
  };

  // Add reversal transaction to active ledger
  activeMemoryPayments.unshift(reversalTransaction);

  // 3. Rollback schedules and balances
  const loanIndex = memoryLoans.findIndex((l) => l.id === loan.id);
  if (loanIndex !== -1) {
    const memLoan = memoryLoans[loanIndex];

    if (payment.allocations && payment.allocations.length > 0) {
      for (const alloc of payment.allocations) {
        const sched = memLoan.repayments?.find(
          (s) => s.id === alloc.repaymentScheduleId || s.installmentNumber === alloc.installmentNumber
        );
        if (sched) {
          sched.principalPaid = Math.max(0, round2((sched.principalPaid || 0) - alloc.principalAllocated));
          sched.interestPaid = Math.max(0, round2((sched.interestPaid || 0) - alloc.interestAllocated));
          sched.feesPaid = Math.max(0, round2((sched.feesPaid || 0) - alloc.feesAllocated));
          sched.penaltyPaid = Math.max(0, round2((sched.penaltyPaid || 0) - alloc.penaltyAllocated));
          sched.totalPaid = round2(
            sched.principalPaid + sched.interestPaid + (sched.feesPaid || 0) + (sched.penaltyPaid || 0)
          );
          sched.outstandingAmount = Math.max(0, round2(sched.totalDue - sched.totalPaid));
          sched.outstandingPrincipal = Math.max(0, round2(sched.principalDue - sched.principalPaid));
          sched.outstandingInterest = Math.max(0, round2(sched.interestDue - sched.interestPaid));

          if (sched.totalPaid <= 0) {
            sched.status = new Date(sched.dueDate) < now ? 'OVERDUE' : 'SCHEDULED';
            sched.paidDate = null;
          } else {
            sched.status = 'PARTIALLY_PAID';
          }
        }
      }
    } else {
      // Fallback if allocations array wasn't attached
      const firstPaid = memLoan.repayments?.find((s) => s.status === 'PAID' || s.status === 'PARTIALLY_PAID');
      if (firstPaid) {
        firstPaid.principalPaid = Math.max(0, round2((firstPaid.principalPaid || 0) - payment.amount));
        firstPaid.totalPaid = Math.max(0, round2((firstPaid.totalPaid || 0) - payment.amount));
        firstPaid.outstandingAmount = Math.max(0, round2(firstPaid.totalDue - firstPaid.totalPaid));
        firstPaid.status = firstPaid.totalPaid > 0 ? 'PARTIALLY_PAID' : 'SCHEDULED';
      }
    }

    // Restore loan balance
    const restoredBalance = round2(memLoan.remainingBalance + payment.amount);
    memLoan.remainingBalance = restoredBalance;
    memLoan.totalPaidAmount = Math.max(0, round2((memLoan.totalPaidAmount || 0) - payment.amount));

    if (memLoan.status === 'CLOSED_PAID_OFF' && restoredBalance > 0) {
      memLoan.status = 'ACTIVE';
      memLoan.closedAt = null;
    }

    memLoan.payments = [reversalTransaction, ...(memLoan.payments || [])];
  }

  // Database persistence
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            allocationStatus: 'REVERSED',
            notes: `${payment.notes || ''} [REVERSED: ${reason}]`,
          },
        });

        await tx.loan.update({
          where: { id: loan.id },
          data: {
            totalPaidAmount: { decrement: payment.amount },
            totalOutstandingBalance: { increment: payment.amount },
            status: 'ACTIVE',
          },
        });
      });
    } catch (err) {
      logger.error('Error persisting reversal to database:', err);
    }
  }

  // Audit Logging
  await recordAuditLog({
    userId: actor.userId,
    action: 'PAYMENT_REVERSED',
    resource: 'Payment',
    resourceId: payment.id,
    details: {
      loanNumber: loan.loanNumber,
      reversedPaymentReference: payment.paymentReference,
      reversalReference: reversalRef,
      amount: payment.amount,
      reason: reason.trim(),
    },
  });

  dispatchNotification({
    eventType: 'PAYMENT_REVERSED',
    recipientUserId: loan.customerId,
    recipientCustomerId: loan.customerId,
    templateData: {
      reversalReference: reversalRef,
      paymentReference: payment.paymentReference,
      amount: payment.amount,
      loanNumber: loan.loanNumber,
      customerName: loan.customer ? `${loan.customer.firstName} ${loan.customer.lastName}` : 'Valued Client',
      customerFirstName: 'Client',
      reversalReason: reason.trim(),
      phone: loan.customer?.phone,
      email: loan.customer?.email,
    },
  }).catch((err) => logger.warn('Failed to dispatch payment reversed notification:', err));

  return { originalPayment: payment, reversalTransaction };
}

/**
 * Generates or retrieves a payment receipt DTO
 */
export async function getPaymentReceipt(identifier: string): Promise<PaymentReceiptDTO> {
  const payment = activeMemoryPayments.find(
    (p) => p.id === identifier || p.paymentReference === identifier || p.receiptNumber === identifier
  );
  if (!payment) {
    throw AppError.notFound(`Receipt for "${identifier}" not found.`);
  }

  if (payment.receipt) {
    return payment.receipt;
  }

  const loan = await getLoanById(payment.loanId);
  const now = new Date(payment.paymentDate);

  const receipt: PaymentReceiptDTO = {
    receiptNumber: payment.receiptNumber || `RCP-${payment.id}`,
    paymentReference: payment.paymentReference || payment.transactionRef,
    transactionReference: payment.transactionRef,
    paymentDate: payment.paymentDate,
    loanId: loan.id,
    loanNumber: loan.loanNumber,
    productName: loan.product?.name || 'Commercial Credit',
    customerId: loan.customerId,
    customerName: loan.customer
      ? `${loan.customer.firstName} ${loan.customer.lastName}`.trim()
      : 'Valued Client',
    customerNumber: loan.customer?.customerNumber,
    customerPhone: loan.customer?.phone,
    amountPaid: payment.amount,
    currency: 'TZS',
    paymentMethod: payment.method,
    allocation: {
      penalties: payment.penaltyAllocated || 0,
      fees: payment.feesAllocated || 0,
      interest: payment.interestAllocated || 0,
      principal: payment.principalAllocated || payment.amount,
      overpayment: payment.overpaymentAmount || 0,
    },
    allocationStrategy: payment.allocationStrategy || 'PENALTIES_FEES_INTEREST_PRINCIPAL',
    overpaymentRule: payment.overpaymentRule || 'APPLY_TO_NEXT_INSTALLMENTS',
    previousBalance: round2(loan.remainingBalance + payment.amount),
    newBalance: loan.remainingBalance,
    remainingPrincipal: loan.principalAmount - (loan.totalPaidAmount || 0),
    remainingInterest: 0,
    remainingFees: 0,
    remainingPenalties: 0,
    nextInstallment: null,
    receivedByStaffName:
      payment.receivedBy
        ? `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`.trim()
        : 'Authorized Cashier',
    receivedByStaffRole: payment.receivedBy?.role || 'CASHIER',
    notes: payment.notes || null,
    isReversal: payment.isReversal || false,
    issuedAt: now.toISOString(),
  };

  payment.receipt = receipt;
  return receipt;
}

