import assert from 'node:assert/strict';
import {
  createPayment,
  reversePayment,
  computePaymentAllocation,
  getPriorityComponents,
  getPaymentReceipt,
  getAllPayments,
  activeMemoryPayments,
} from '../server/services/payments.service.js';
import { memoryLoans, getLoanById } from '../server/services/loans.service.js';
import { LoanDTO, RepaymentScheduleDTO, UserRole } from '../shared/types/index.js';

console.log('🧪 Starting Repayment Management & Allocation Automated Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

async function testAsync(description: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(err);
    process.exit(1);
  }
}

const mockCashier = {
  userId: 'staff-csh-01',
  role: 'CASHIER' as UserRole,
  firstName: 'Chloe',
  lastName: 'Bennett',
};

// Helper: Build a clean mock loan with explicit multi-installment schedules
function buildTestLoan(id: string, overrides: Partial<LoanDTO> = {}): LoanDTO {
  const schedules: RepaymentScheduleDTO[] = [
    {
      id: `sched-${id}-01`,
      installmentNumber: 1,
      dueDate: '2026-02-20T00:00:00.000Z',
      principalDue: 1000000,
      interestDue: 100000,
      feesDue: 20000,
      penaltyDue: 50000, // Late penalty assessed
      totalDue: 1170000,
      principalPaid: 0,
      interestPaid: 0,
      feesPaid: 0,
      penaltyPaid: 0,
      totalPaid: 0,
      outstandingAmount: 1170000,
      status: 'OVERDUE',
      paidDate: null,
    },
    {
      id: `sched-${id}-02`,
      installmentNumber: 2,
      dueDate: '2026-03-20T00:00:00.000Z',
      principalDue: 1000000,
      interestDue: 90000,
      feesDue: 0,
      penaltyDue: 0,
      totalDue: 1090000,
      principalPaid: 0,
      interestPaid: 0,
      feesPaid: 0,
      penaltyPaid: 0,
      totalPaid: 0,
      outstandingAmount: 1090000,
      status: 'SCHEDULED',
      paidDate: null,
    },
    {
      id: `sched-${id}-03`,
      installmentNumber: 3,
      dueDate: '2026-04-20T00:00:00.000Z',
      principalDue: 1000000,
      interestDue: 80000,
      feesDue: 0,
      penaltyDue: 0,
      totalDue: 1080000,
      principalPaid: 0,
      interestPaid: 0,
      feesPaid: 0,
      penaltyPaid: 0,
      totalPaid: 0,
      outstandingAmount: 1080000,
      status: 'SCHEDULED',
      paidDate: null,
    },
  ];

  const totalPayable = schedules.reduce((s, item) => s + item.totalDue, 0);

  const loan: LoanDTO = {
    id,
    loanNumber: `LN-TEST-${id}`,
    customerId: 'cust-test-01',
    customer: {
      id: 'cust-test-01',
      customerNumber: 'CUST-2026-0099',
      firstName: 'Baraka',
      lastName: 'Makani',
      email: 'baraka@example.com',
      phone: '+255 754 000 111',
      idType: 'NATIONAL_ID',
      idNumber: 'TZ-NIDA-998811',
      monthlyIncome: 8000000,
      employmentType: 'SELF_EMPLOYED',
      profileStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
    },
    productId: 'prod-sme-01',
    product: {
      id: 'prod-sme-01',
      code: 'PROD_SME',
      name: 'SME Commercial Credit',
      description: 'SME Commercial Credit Facility',
      minAmount: 1000000,
      maxAmount: 100000000,
      minTermMonths: 3,
      maxTermMonths: 36,
      baseInterestRate: 10,
      interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
      repaymentFrequency: 'MONTHLY',
      processingFeeValue: 20000,
      penaltyRate: 5,
      gracePeriodDays: 5,
      isActive: true,
    },
    principalAmount: 3000000,
    interestRate: 10,
    termMonths: 3,
    repaymentFrequency: 'MONTHLY',
    totalInterest: 270000,
    totalPayable,
    monthlyInstallment: 1090000,
    remainingBalance: totalPayable,
    totalPaidAmount: 0,
    status: 'ACTIVE',
    purpose: 'Test facility for automated repayment suite',
    applicationDate: '2026-01-01T00:00:00.000Z',
    repayments: schedules,
    payments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };

  return loan;
}

// ----------------------------------------------------------------------------
// Test Group 1: Configurable Allocation Priority Calculations
// ----------------------------------------------------------------------------
console.log('--- Group 1: Configurable Allocation Priority Calculations ---');

await testAsync('Allocation priority strategy mappings are strictly resolved', () => {
  const std = getPriorityComponents('PENALTIES_FEES_INTEREST_PRINCIPAL');
  assert.deepEqual(std, ['PENALTIES', 'FEES', 'INTEREST', 'PRINCIPAL']);

  const feeFirst = getPriorityComponents('FEES_PENALTIES_INTEREST_PRINCIPAL');
  assert.deepEqual(feeFirst, ['FEES', 'PENALTIES', 'INTEREST', 'PRINCIPAL']);

  const intFirst = getPriorityComponents('INTEREST_FEES_PENALTIES_PRINCIPAL');
  assert.deepEqual(intFirst, ['INTEREST', 'FEES', 'PENALTIES', 'PRINCIPAL']);

  const principalFirst = getPriorityComponents('PRINCIPAL_FIRST');
  assert.deepEqual(principalFirst, ['PRINCIPAL', 'INTEREST', 'FEES', 'PENALTIES']);

  const custom = getPriorityComponents('CUSTOM', ['PRINCIPAL', 'FEES', 'PENALTIES', 'INTEREST']);
  assert.deepEqual(custom, ['PRINCIPAL', 'FEES', 'PENALTIES', 'INTEREST']);
});

await testAsync('Standard Allocation: Waterfalls funds to Penalties first, then Fees, Interest, and Principal', () => {
  const testLoan = buildTestLoan('alloc-01');
  // Installment 1 has: Penalty: 50,000 | Fees: 20,000 | Interest: 100,000 | Principal: 1,000,000
  // Paying exactly 120,000:
  // - 50,000 to Penalties
  // - 20,000 to Fees
  // - 50,000 to Interest (out of 100,000)
  // - 0 to Principal
  const alloc = computePaymentAllocation(testLoan, 120000, '2026-02-25T10:00:00.000Z', {
    strategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
  });

  assert.equal(alloc.totalPenaltiesAllocated, 50000, 'Penalties must be fully satisfied first');
  assert.equal(alloc.totalFeesAllocated, 20000, 'Fees must be fully satisfied second');
  assert.equal(alloc.totalInterestAllocated, 50000, 'Remaining 50,000 must go to interest');
  assert.equal(alloc.totalPrincipalAllocated, 0, 'No funds remaining for principal');
  assert.equal(alloc.totalAllocated, 120000, 'Total allocated must equal payment amount');
});

await testAsync('Alternative Strategy: Principal First prioritizes debt curtailment', () => {
  const testLoan = buildTestLoan('alloc-02');
  // Paying 500,000 with PRINCIPAL_FIRST:
  // - 500,000 goes directly to Principal
  // - 0 to Interest, Fees, Penalties
  const alloc = computePaymentAllocation(testLoan, 500000, '2026-02-25T10:00:00.000Z', {
    strategy: 'PRINCIPAL_FIRST',
  });

  assert.equal(alloc.totalPrincipalAllocated, 500000, 'Principal must be satisfied first');
  assert.equal(alloc.totalInterestAllocated, 0);
  assert.equal(alloc.totalFeesAllocated, 0);
  assert.equal(alloc.totalPenaltiesAllocated, 0);
});

// ----------------------------------------------------------------------------
// Test Group 2: Full & Partial Repayment Execution
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Full & Partial Repayment Execution ---');

await testAsync('Partial payment updates installment status to PARTIALLY_PAID and reduces balances', async () => {
  const testLoan = buildTestLoan('part-01');
  memoryLoans.unshift(testLoan);

  // Installment 1 total due is 1,170,000. Pay 600,000.
  const payment = await createPayment(
    {
      loanId: testLoan.id,
      amount: 600000,
      paymentMethod: 'MOBILE_MONEY',
      transactionReference: 'MPESA-TXN-PARTIAL-01',
      paymentDate: '2026-02-25T10:00:00.000Z',
      allocationStrategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
      notes: 'Partial settlement via mobile wallet',
    },
    mockCashier
  );

  assert.equal(payment.amount, 600000);
  assert.equal(payment.status, 'FULLY_ALLOCATED');
  assert.equal(payment.penaltyAllocated, 50000);
  assert.equal(payment.feesAllocated, 20000);
  assert.equal(payment.interestAllocated, 100000);
  assert.equal(payment.principalAllocated, 430000); // 600,000 - 50,000 - 20,000 - 100,000 = 430,000

  // Verify updated loan state in master ledger
  const updatedLoan = await getLoanById(testLoan.id);
  const firstInst = updatedLoan.repayments![0];
  assert.equal(firstInst.status, 'PARTIALLY_PAID', 'Installment status must be PARTIALLY_PAID');
  assert.equal(firstInst.totalPaid, 600000);
  assert.equal(firstInst.outstandingAmount, 570000, 'Remaining on installment 1 must be 570,000');
  assert.equal(updatedLoan.remainingBalance, testLoan.totalPayable - 600000);
  assert.equal(updatedLoan.totalPaidAmount, 600000);
});

await testAsync('Full installment payment sets status to PAID and sets paidDate', async () => {
  const testLoan = buildTestLoan('full-01');
  memoryLoans.unshift(testLoan);

  // Exactly pay off Installment 1 (1,170,000)
  const payment = await createPayment(
    {
      loanId: testLoan.id,
      amount: 1170000,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: 'CRDB-TISS-FULL-01',
      paymentDate: '2026-02-25T12:00:00.000Z',
      allocationStrategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
      notes: 'Full installment settlement',
    },
    mockCashier
  );

  assert.equal(payment.amount, 1170000);
  assert.equal(payment.penaltyAllocated, 50000);
  assert.equal(payment.feesAllocated, 20000);
  assert.equal(payment.interestAllocated, 100000);
  assert.equal(payment.principalAllocated, 1000000);

  const updatedLoan = await getLoanById(testLoan.id);
  const firstInst = updatedLoan.repayments![0];
  assert.equal(firstInst.status, 'PAID', 'Installment must be marked as PAID');
  assert.equal(firstInst.outstandingAmount, 0);
  assert.ok(firstInst.paidDate, 'paidDate must be recorded');
  assert.equal(updatedLoan.remainingBalance, testLoan.totalPayable - 1170000);
});

await testAsync('Late payment on overdue installment clears accrued penalty and transitions out of OVERDUE', async () => {
  const testLoan = buildTestLoan('late-01');
  memoryLoans.unshift(testLoan);

  // Installment 1 has dueDate 2026-02-20 and status OVERDUE with 50,000 penalty, 20,000 fee, 100,000 interest, 1,000,000 principal.
  // Borrower pays late on 2026-03-05: 1,170,000 total
  const payment = await createPayment(
    {
      loanId: testLoan.id,
      amount: 1170000,
      paymentMethod: 'CASH',
      transactionReference: 'CSH-LATE-SETTLE-01',
      paymentDate: '2026-03-05T14:30:00.000Z',
      allocationStrategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
      notes: 'Late settlement covering delinquent installment and penalty charges',
    },
    mockCashier
  );

  assert.equal(payment.penaltyAllocated, 50000, 'Late penalty must be prioritized and paid in full');
  assert.equal(payment.feesAllocated, 20000, 'Overdue fees satisfied');
  assert.equal(payment.interestAllocated, 100000, 'Interest satisfied');
  assert.equal(payment.principalAllocated, 1000000, 'Principal satisfied');

  const updatedLoan = await getLoanById(testLoan.id);
  const firstInst = updatedLoan.repayments![0];
  assert.equal(firstInst.status, 'PAID', 'Delinquent installment must transition from OVERDUE to PAID');
  assert.equal(firstInst.outstandingAmount, 0, 'Delinquent installment outstanding must be 0');
  assert.equal(firstInst.penaltyPaid, 50000, 'Accrued penalty must be marked as paid');
});

// ----------------------------------------------------------------------------
// Test Group 3: Multi-Installment Cascade & Overpayments
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Multi-Installment Cascade & Overpayments ---');

await testAsync('Payment covering multiple installments cascades sequentially through schedule', async () => {
  const testLoan = buildTestLoan('multi-01');
  memoryLoans.unshift(testLoan);

  // Installment 1 = 1,170,000
  // Installment 2 = 1,090,000
  // Total for both = 2,260,000. Let's pay 2,500,000:
  // - Pays Installment 1 in full (1,170,000) -> PAID
  // - Pays Installment 2 in full (1,090,000) -> PAID
  // - Remaining 240,000 cascades into Installment 3 -> PARTIALLY_PAID
  const payment = await createPayment(
    {
      loanId: testLoan.id,
      amount: 2500000,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: 'NMB-RTGS-MULTI-01',
      paymentDate: '2026-03-01T10:00:00.000Z',
      allocationStrategy: 'PENALTIES_FEES_INTEREST_PRINCIPAL',
      overpaymentRule: 'APPLY_TO_NEXT_INSTALLMENTS',
    },
    mockCashier
  );

  assert.equal(payment.amount, 2500000);
  assert.equal(payment.allocations?.length, 3, 'Must allocate across all 3 installments');

  const updatedLoan = await getLoanById(testLoan.id);
  assert.equal(updatedLoan.repayments![0].status, 'PAID', 'Installment 1 must be PAID');
  assert.equal(updatedLoan.repayments![1].status, 'PAID', 'Installment 2 must be PAID');
  assert.equal(updatedLoan.repayments![2].status, 'PARTIALLY_PAID', 'Installment 3 must be PARTIALLY_PAID');
  assert.equal(updatedLoan.repayments![2].totalPaid, 240000, 'Installment 3 received 240,000');
});

await testAsync('Overpayment exceeding full loan balance closes loan as CLOSED_PAID_OFF and logs excess pool', async () => {
  const testLoan = buildTestLoan('overpay-01');
  memoryLoans.unshift(testLoan);

  const totalBalance = testLoan.totalPayable; // 3,340,000
  const overpayAmount = totalBalance + 500000; // 3,840,000 (500k overpayment)

  const payment = await createPayment(
    {
      loanId: testLoan.id,
      amount: overpayAmount,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: 'CLEARING-PAYOFF-01',
      overpaymentRule: 'HOLD_AS_UNALLOCATED_CREDIT',
    },
    mockCashier
  );

  assert.equal(payment.overpaymentAmount, 500000, 'Excess 500k must be captured as overpayment pool');

  const updatedLoan = await getLoanById(testLoan.id);
  assert.equal(updatedLoan.remainingBalance, 0, 'Facility remaining balance must be 0');
  assert.equal(updatedLoan.status, 'CLOSED_PAID_OFF', 'Facility must transition to CLOSED_PAID_OFF');
  assert.ok(
    updatedLoan.repayments!.every((s) => s.status === 'PAID'),
    'All installments must be marked PAID'
  );
});

// ----------------------------------------------------------------------------
// Test Group 4: Immutability & Audited Payment Reversals
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Immutability & Audited Payment Reversals ---');

await testAsync('Payment reversal creates an accounting reversal transaction, restores balances, and preserves history', async () => {
  const testLoan = buildTestLoan('rev-01');
  memoryLoans.unshift(testLoan);

  const initialBalance = testLoan.remainingBalance;

  // 1. Post a payment of 1,170,000 to fully pay installment 1
  const originalPayment = await createPayment(
    {
      loanId: testLoan.id,
      amount: 1170000,
      paymentMethod: 'CASH',
      transactionReference: 'VOUCHER-CSH-4410',
      notes: 'Counter payment to be reversed later due to dishonour',
    },
    mockCashier
  );

  let loanAfterPayment = await getLoanById(testLoan.id);
  assert.equal(loanAfterPayment.repayments![0].status, 'PAID');
  assert.equal(loanAfterPayment.remainingBalance, initialBalance - 1170000);

  // 2. Execute Reversal
  const reversalReason = 'Counter entry error: teller credited wrong customer facility account.';
  const { originalPayment: updatedOriginal, reversalTransaction } = await reversePayment(
    originalPayment.id,
    reversalReason,
    mockCashier
  );

  // Verify original record was NOT deleted
  assert.equal(updatedOriginal.status, 'REVERSED', 'Original payment must be marked REVERSED');
  assert.ok(updatedOriginal.notes?.includes(reversalReason), 'Reversal notes must be appended');
  assert.ok(updatedOriginal.reversedAt, 'Reversal timestamp must be recorded');

  // Verify companion reversal transaction was created
  assert.ok(reversalTransaction, 'Companion reversal transaction must be created');
  assert.equal(reversalTransaction.isReversal, true);
  assert.equal(reversalTransaction.amount, -1170000, 'Reversal transaction must have negated amount');
  assert.equal(reversalTransaction.reversedPaymentId, originalPayment.id);

  // Verify loan balances and installments were completely restored
  const loanAfterReversal = await getLoanById(testLoan.id);
  assert.equal(
    loanAfterReversal.remainingBalance,
    initialBalance,
    'Loan remaining balance must be restored to original balance'
  );
  assert.equal(loanAfterReversal.totalPaidAmount, 0, 'Total paid amount must be rolled back');
  const restoredInst = loanAfterReversal.repayments![0];
  assert.equal(
    restoredInst.status,
    'OVERDUE',
    'Installment status must roll back from PAID to OVERDUE'
  );
  assert.equal(restoredInst.outstandingAmount, 1170000, 'Installment outstanding balance restored');
  assert.equal(restoredInst.totalPaid, 0);

  // Verify reversal is recorded in ledger query
  const allLedger = await getAllPayments({ loanId: testLoan.id });
  const hasRevEntry = allLedger.some((p) => p.isReversal && p.reversedPaymentId === originalPayment.id);
  assert.ok(hasRevEntry, 'Reversal entry must be present in payment ledger');
});

await testAsync('Attempting to reverse an already reversed payment throws error', async () => {
  const testLoan = buildTestLoan('rev-guard-01');
  memoryLoans.unshift(testLoan);

  const payment = await createPayment(
    {
      loanId: testLoan.id,
      amount: 500000,
      paymentMethod: 'BANK_TRANSFER',
    },
    mockCashier
  );

  // First reversal succeeds
  await reversePayment(payment.id, 'First valid reversal justification.', mockCashier);

  // Second reversal must throw
  let thrown = false;
  try {
    await reversePayment(payment.id, 'Duplicate reversal attempt.', mockCashier);
  } catch (err: any) {
    thrown = true;
    assert.ok(err.message.includes('already been reversed'));
  }
  assert.ok(thrown, 'Duplicate reversal must be prevented');
});

// ----------------------------------------------------------------------------
// Test Group 5: Official Payment Receipts
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Official Payment Receipts ---');

await testAsync('Recording a payment generates an official receipt with all regulatory breakdown fields', async () => {
  const testLoan = buildTestLoan('receipt-01');
  memoryLoans.unshift(testLoan);

  const payment = await createPayment(
    {
      loanId: testLoan.id,
      amount: 1170000,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: 'TXN-BANK-RCP-01',
    },
    mockCashier
  );

  assert.ok(payment.receipt, 'Payment must include generated receipt DTO');
  const receipt = payment.receipt;

  assert.ok(receipt.receiptNumber.startsWith('RCP-'), 'Receipt number must follow standardized sequence');
  assert.equal(receipt.loanNumber, testLoan.loanNumber);
  assert.equal(receipt.customerName, 'Baraka Makani');
  assert.equal(receipt.amountPaid, 1170000);
  assert.equal(receipt.currency, 'TZS');
  assert.equal(receipt.paymentMethod, 'BANK_TRANSFER');
  assert.equal(receipt.allocation.penalties, 50000);
  assert.equal(receipt.allocation.fees, 20000);
  assert.equal(receipt.allocation.interest, 100000);
  assert.equal(receipt.allocation.principal, 1000000);
  assert.ok(receipt.receivedByStaffName, 'Staff name must be recorded on receipt');

  // Verify fetchable via getPaymentReceipt endpoint
  const fetchedReceipt = await getPaymentReceipt(receipt.receiptNumber);
  assert.equal(fetchedReceipt.receiptNumber, receipt.receiptNumber);
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Repayment Management Automated Tests Passed Successfully!`);
