import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import {
  calculateLoan,
  calculateDueDate,
  calculateFees,
  calculateNumberOfInstallments,
  getPeriodsPerYear,
} from '../server/services/loan-calculator.service.js';
import {
  createApplication,
  submitApplication,
  recommendApplication,
  recordCreditAssessment,
  transitionApplicationStatus,
  getApplicationById,
  ALLOWED_APPLICATION_TRANSITIONS,
} from '../server/services/applications.service.js';
import {
  createApprovedLoanRecord,
  disburseLoanFacility,
  getLoanById,
  memoryLoans,
} from '../server/services/loans.service.js';
import {
  createPayment,
  computePaymentAllocation,
  getPriorityComponents,
  getPaymentReceipt,
} from '../server/services/payments.service.js';
import { LoanDTO, RepaymentScheduleDTO, UserRole } from '../shared/types/index.js';

console.log('🧪 Starting Nexa LMS Comprehensive Loans Lifecycle & Financial Calculations Test Suite...\n');

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

const mockCreditOfficer = {
  userId: 'staff-credit-01',
  role: 'CREDIT_OFFICER' as UserRole,
  firstName: 'Elena',
  lastName: 'Rostova',
};

const mockUnderwriter = {
  userId: 'staff-und-01',
  role: 'UNDERWRITER' as UserRole,
  firstName: 'Julian',
  lastName: 'Thorne',
};

const mockBranchManager = {
  userId: 'user-manager-01',
  role: 'BRANCH_MANAGER' as UserRole,
  firstName: 'David',
  lastName: 'Sterling',
};

const mockCashier = {
  userId: 'staff-cashier-01',
  role: 'CASHIER' as UserRole,
  firstName: 'Chloe',
  lastName: 'Bennett',
};

// ==============================================================================
// Group 1: Financial Arithmetic & Calculation Engine Unit Tests
// ==============================================================================
console.log('--- Group 1: Financial Calculations Unit Tests (Flat, Reducing, Fees, Penalties) ---');

await testAsync('Flat interest formula calculates exact total interest, installment, and amortization sum', async () => {
  const principal = 2400000; // 2.4M TZS
  const annualRate = 15; // 15% flat APR
  const termMonths = 12;

  const result = calculateLoan({
    principal,
    annualRate,
    termMonths,
    interestCalculationMethod: 'FLAT_RATE',
    repaymentFrequency: 'MONTHLY',
  });

  // Flat Interest = 2,400,000 * 0.15 * 1 year = 360,000
  assert.strictEqual(result.totalInterest, 360000, 'Total flat interest must equal 360,000');
  assert.strictEqual(result.totalPayable, 2760000, 'Total payable must equal 2,760,000');
  // Monthly installment = 2,760,000 / 12 = 230,000
  assert.strictEqual(result.installmentAmount, 230000, 'Monthly installment must equal 230,000');
  assert.strictEqual(result.schedule.length, 12, 'Schedule must contain exactly 12 items');

  // Verify principal sum equals initial principal
  const principalSum = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.strictEqual(principalSum, principal, 'Sum of scheduled principal due must match initial principal');
  // Verify final remaining balance is 0
  assert.strictEqual(result.schedule[11].remainingBalance, 0, 'Final schedule remaining balance must be 0.00');
});

await testAsync('Reducing balance (French Amortization) ensures decreasing interest and zero ending balance', async () => {
  const principal = 10000000; // 10M TZS
  const annualRate = 18; // 18% APR
  const termMonths = 6;

  const result = calculateLoan({
    principal,
    annualRate,
    termMonths,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
  });

  assert.strictEqual(result.numberOfInstallments, 6);
  assert.strictEqual(result.schedule.length, 6);

  // Interest component must strictly decrease across installments
  for (let i = 1; i < result.schedule.length; i++) {
    assert.ok(
      result.schedule[i].interestDue < result.schedule[i - 1].interestDue,
      `Interest in installment ${i + 1} (${result.schedule[i].interestDue}) must be less than installment ${i} (${result.schedule[i - 1].interestDue})`
    );
    // Principal component must strictly increase
    assert.ok(
      result.schedule[i].principalDue > result.schedule[i - 1].principalDue,
      `Principal in installment ${i + 1} (${result.schedule[i].principalDue}) must be greater than installment ${i} (${result.schedule[i - 1].principalDue})`
    );
  }

  // Exact principal balance check down to the cent
  const totalPrincipalScheduled = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.strictEqual(totalPrincipalScheduled, principal, 'Sum of principal due must equal exact principal');
  assert.strictEqual(result.schedule[5].remainingBalance, 0, 'Final remaining balance must be exactly 0.00');
});

await testAsync('Installment calculation handles diverse repayment frequencies (Weekly, Bi-Weekly, Quarterly)', async () => {
  // Weekly for 12 months = 52 installments
  assert.strictEqual(calculateNumberOfInstallments(12, 'WEEKLY'), 52);
  assert.strictEqual(getPeriodsPerYear('WEEKLY'), 52);

  // Bi-Weekly for 12 months = 26 installments
  assert.strictEqual(calculateNumberOfInstallments(12, 'BI_WEEKLY'), 26);
  assert.strictEqual(getPeriodsPerYear('BI_WEEKLY'), 26);

  // Quarterly for 24 months = 8 installments
  assert.strictEqual(calculateNumberOfInstallments(24, 'QUARTERLY'), 8);
  assert.strictEqual(getPeriodsPerYear('QUARTERLY'), 4);
});

await testAsync('Fee calculations support percentage of principal and fixed fee structures', async () => {
  const principal = new Decimal('5000000'); // 5M TZS

  // 2.5% processing fee
  const pctFee = calculateFees(principal, 'PERCENTAGE_OF_PRINCIPAL', 2.5);
  assert.strictEqual(pctFee.toNumber(), 125000, '5,000,000 * 2.5% = 125,000');

  // Fixed documentation fee
  const fixedFee = calculateFees(principal, 'FIXED_AMOUNT', 50000);
  assert.strictEqual(fixedFee.toNumber(), 50000, 'Fixed fee must equal 50,000');
});

// ==============================================================================
// Group 2: Payment Allocation, Penalties, Overpayments & Partial Payments
// ==============================================================================
console.log('\n--- Group 2: Payment Allocation, Partial Payments, Penalties & Overpayments ---');

await testAsync('Payment allocation enforces strict statutory order: Penalties -> Fees -> Interest -> Principal', async () => {
  const dummyLoan: LoanDTO = {
    id: 'ln-test-alloc-priority',
    loanNumber: 'LN-ALLOC-001',
    customerId: 'cust-01',
    principalAmount: 1000000,
    interestRate: 12,
    termMonths: 1,
    repaymentFrequency: 'MONTHLY',
    status: 'ACTIVE',
    totalInterest: 100000,
    totalPayable: 1100000,
    monthlyInstallment: 1100000,
    purpose: 'Commercial Working Capital',
    applicationDate: new Date().toISOString(),
    productId: 'prod-sme-01',
    totalPaidAmount: 0,
    remainingBalance: 1100000,
    repayments: [
      {
        id: 'sched-alloc-01',
        installmentNumber: 1,
        dueDate: '2026-02-15T00:00:00.000Z',
        principalDue: 1000000,
        interestDue: 100000,
        feesDue: 30000,
        penaltyDue: 50000, // Assessed delinquency penalty
        totalDue: 1180000,
        principalPaid: 0,
        interestPaid: 0,
        feesPaid: 0,
        penaltyPaid: 0,
        totalPaid: 0,
        outstandingAmount: 1180000,
        status: 'OVERDUE',
        paidDate: null,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Case A: Partial payment of 60,000 TZS
  // Should fully cover 50,000 penalty and 10,000 of fees (20,000 fees remaining, 0 interest, 0 principal)
  const allocA = computePaymentAllocation(dummyLoan, 60000, '2026-02-20T00:00:00.000Z');
  assert.strictEqual(allocA.totalPenaltiesAllocated, 50000, 'Penalty must be paid first');
  assert.strictEqual(allocA.totalFeesAllocated, 10000, 'Remaining 10,000 allocated to fees');
  assert.strictEqual(allocA.totalInterestAllocated, 0, 'No funds reached interest');
  assert.strictEqual(allocA.totalPrincipalAllocated, 0, 'No funds reached principal');
  assert.strictEqual(allocA.newTotalOutstandingBalance, 1120000, '1,180,000 - 60,000 = 1,120,000');

  // Case B: Payment covering penalties (50,000) + fees (30,000) + interest (100,000) + partial principal (200,000) = 380,000
  const allocB = computePaymentAllocation(dummyLoan, 380000, '2026-02-20T00:00:00.000Z');
  assert.strictEqual(allocB.totalPenaltiesAllocated, 50000);
  assert.strictEqual(allocB.totalFeesAllocated, 30000);
  assert.strictEqual(allocB.totalInterestAllocated, 100000);
  assert.strictEqual(allocB.totalPrincipalAllocated, 200000);
  assert.strictEqual(allocB.newTotalOutstandingBalance, 800000);
});

await testAsync('Overpayment beyond total balance is calculated and identified', async () => {
  const dummyLoan: LoanDTO = {
    id: 'ln-test-overpayment',
    loanNumber: 'LN-OVERPAY-001',
    customerId: 'cust-01',
    principalAmount: 500000,
    interestRate: 10,
    termMonths: 1,
    repaymentFrequency: 'MONTHLY',
    status: 'ACTIVE',
    totalInterest: 50000,
    totalPayable: 550000,
    monthlyInstallment: 550000,
    purpose: 'Equipment Purchase',
    applicationDate: new Date().toISOString(),
    productId: 'prod-sme-01',
    totalPaidAmount: 0,
    remainingBalance: 550000,
    repayments: [
      {
        id: 'sched-overpay-01',
        installmentNumber: 1,
        dueDate: '2026-03-01T00:00:00.000Z',
        principalDue: 500000,
        interestDue: 50000,
        feesDue: 0,
        penaltyDue: 0,
        totalDue: 550000,
        principalPaid: 0,
        interestPaid: 0,
        feesPaid: 0,
        penaltyPaid: 0,
        totalPaid: 0,
        outstandingAmount: 550000,
        status: 'SCHEDULED',
        paidDate: null,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Pay 600,000 against a total due of 550,000
  const alloc = computePaymentAllocation(dummyLoan, 600000, '2026-03-01T00:00:00.000Z');
  assert.strictEqual(alloc.totalPrincipalAllocated, 500000);
  assert.strictEqual(alloc.totalInterestAllocated, 50000);
  assert.strictEqual(alloc.overpaymentAmount, 50000, 'Excess 50,000 must be marked as overpayment');
  assert.strictEqual(alloc.newTotalOutstandingBalance, 0, 'Remaining balance reaches zero');
  assert.strictEqual(alloc.loanStatus, 'CLOSED_PAID_OFF', 'Loan status transitions to CLOSED_PAID_OFF');
});

// ==============================================================================
// Group 3: Loan Origination, Approval, Rejection & Disbursement Lifecycle
// ==============================================================================
console.log('\n--- Group 3: Loan Application, Approval, Rejection & Disbursement Workflows ---');

let testAppId = '';

await testAsync('Loan application origination creates draft record with actuarial calculation', async () => {
  const app = await createApplication(
    'user-cust-01',
    {
      productId: 'prod-sme-01',
      principalAmount: 100000, // 100,000 (within 25k-500k bounds)
      termMonths: 12,
      purpose: 'Acquisition of warehouse storage refrigeration units',
      repaymentFrequency: 'MONTHLY',
      status: 'DRAFT',
      bankDetails: {
        bankName: 'CRDB Bank Plc',
        accountNumber: 'TZ012345678901',
        accountName: 'Alexander Hayes Trading Enterprise',
      },
    },
    {
      firstName: 'Alexander',
      lastName: 'Hayes',
      email: 'customer@nexa.financial',
    }
  );

  assert.ok(app, 'Application must be created');
  assert.ok(app.id, 'Application must have id');
  assert.strictEqual(app.status, 'DRAFT', 'Initial status must be DRAFT');
  assert.strictEqual(app.requestedAmount, 100000);
  assert.strictEqual(app.requestedTermMonths, 12);

  testAppId = app.id;
});

await testAsync('Submitting application transitions status from DRAFT to SUBMITTED', async () => {
  assert.ok(testAppId);
  const submitted = await submitApplication(testAppId, 'user-officer-01');
  assert.strictEqual(submitted.status, 'SUBMITTED', 'Status must transition to SUBMITTED');
});

await testAsync('Review and Credit Assessment progression', async () => {
  assert.ok(testAppId);
  // 1. Move to UNDER_REVIEW
  const underReview = await transitionApplicationStatus(
    testAppId,
    mockCreditOfficer,
    {
      targetStatus: 'UNDER_REVIEW',
      notes: 'Initial underwriting inspection started',
    }
  );
  assert.strictEqual(underReview.status, 'UNDER_REVIEW');

  // 2. Recommend application (moves application to CREDIT_ASSESSMENT)
  const recommended = await recommendApplication(
    testAppId,
    mockCreditOfficer,
    {
      recommendation: 'RECOMMEND_APPROVAL',
      notes: 'Strong business cash flows support debt service.',
    }
  );
  assert.ok(recommended);
  assert.strictEqual(recommended.status, 'CREDIT_ASSESSMENT');

  // 3. Record credit score and underwriting assessment
  const assessed = await recordCreditAssessment(
    testAppId,
    mockUnderwriter,
    {
      creditScore: 750,
      monthlyIncome: 8500000,
      monthlyDebtObligations: 1200000,
      debtToIncomeRatio: 14.1,
      riskRating: 'LOW',
      maxRecommendedAmount: 150000,
      assessmentSummary: 'Solid historical debt service coverage and low leverage',
      decisionRecommendation: 'APPROVE',
    }
  );
  assert.ok(assessed);
});

let approvedLoanId = '';

await testAsync('Approving application generates loan facility and sets PENDING_DISBURSEMENT status', async () => {
  assert.ok(testAppId);
  const app = await getApplicationById(testAppId);

  const loan = await createApprovedLoanRecord(
    app,
    100000, // 100,000 approved
    12, // 12 months
    8.75, // 8.75% APR
    mockBranchManager,
    'Approved by Credit Committee with standard covenant requirements'
  );

  assert.ok(loan, 'Loan facility must be created');
  assert.strictEqual(loan.status, 'PENDING_DISBURSEMENT');
  assert.strictEqual(loan.principalAmount, 100000);
  assert.strictEqual(loan.termMonths, 12);
  assert.strictEqual(loan.interestRate, 8.75);
  assert.ok(Array.isArray(loan.repayments), 'Loan must include generated repayment schedules');
  assert.strictEqual(loan.repayments.length, 12, 'Schedule must contain 12 installments');

  approvedLoanId = loan.id;
});

await testAsync('Disbursing loan facility activates facility and transitions status to ACTIVE', async () => {
  assert.ok(approvedLoanId);

  const { loan: disbursed, disbursement } = await disburseLoanFacility(
    approvedLoanId,
    mockCashier,
    {
      paymentMethod: 'BANK_TRANSFER',
      disbursementReference: 'DISB-2026-99014',
      disbursementDate: '2026-03-01T00:00:00.000Z',
      amount: 100000,
      transactionReference: 'TXN-DISB-99014',
      notes: 'Disbursement funds released via automated clearing house (ACH).',
    }
  );

  assert.ok(disbursed, 'Disbursed loan must be returned');
  assert.ok(disbursement, 'Disbursement record must be returned');
  assert.strictEqual(disbursed.status, 'ACTIVE', 'Disbursed loan status must be ACTIVE');
  assert.strictEqual(disbursed.principalAmount, 100000);

  // Repayment schedules must be activated
  assert.ok(disbursed.repayments && disbursed.repayments.length > 0);
  assert.strictEqual(disbursed.repayments[0].status, 'SCHEDULED');
});

// ==============================================================================
// Group 4: Loan Repayment, Receipting & Completion Lifecycle
// ==============================================================================
console.log('\n--- Group 4: Loan Repayment, Receipting & Completion Lifecycle ---');

await testAsync('Recording scheduled repayment reduces outstanding balance and generates official receipt', async () => {
  assert.ok(approvedLoanId);
  const activeLoan = await getLoanById(approvedLoanId);
  const previousBalance = activeLoan.remainingBalance;

  // Pay first installment amount
  const installmentDue = activeLoan.repayments![0].totalDue;
  const payment = await createPayment(
    {
      loanId: approvedLoanId,
      amount: installmentDue,
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: '2026-04-01T00:00:00.000Z',
      paymentReference: 'TXN-PAY-001',
      notes: 'First monthly installment payment by customer',
    },
    mockCashier
  );

  assert.ok(payment, 'Payment transaction record must be created');
  assert.strictEqual(payment.status, 'FULLY_ALLOCATED');
  assert.strictEqual(payment.amount, installmentDue);
  assert.ok(payment.receiptNumber, 'Official receipt number must be generated');

  // Verify updated loan balance
  const updatedLoan = await getLoanById(approvedLoanId);
  assert.strictEqual(
    updatedLoan.totalPaidAmount,
    installmentDue,
    'Loan totalPaidAmount must reflect received payment'
  );
  assert.ok(
    updatedLoan.remainingBalance < previousBalance,
    'Loan remaining balance must be reduced'
  );
});

await testAsync('Full repayment of remaining balance closes loan as CLOSED_PAID_OFF', async () => {
  assert.ok(approvedLoanId);
  const currentLoan = await getLoanById(approvedLoanId);
  const payoffAmount = currentLoan.remainingBalance;

  assert.ok(payoffAmount > 0, 'Payoff amount must be positive');

  // Record payoff payment
  const payoffPayment = await createPayment(
    {
      loanId: approvedLoanId,
      amount: payoffAmount,
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: '2026-05-01T00:00:00.000Z',
      paymentReference: 'TXN-PAYOFF-FINAL',
      notes: 'Full payoff and facility closure by borrower',
    },
    mockCashier
  );

  assert.ok(payoffPayment);

  // Verify loan closure status
  const finalizedLoan = await getLoanById(approvedLoanId);
  assert.strictEqual(
    finalizedLoan.remainingBalance,
    0,
    'Remaining balance must be exactly 0 after full payoff'
  );
  assert.strictEqual(
    finalizedLoan.status,
    'CLOSED_PAID_OFF',
    'Loan status must transition to CLOSED_PAID_OFF upon full settlement'
  );
});

await testAsync('Loan rejection workflow sets terminal status and blocks subsequent transitions', async () => {
  // Create another application to test rejection
  const rejApp = await createApplication(
    'user-cust-01',
    {
      productId: 'prod-sme-01',
      principalAmount: 200000,
      termMonths: 24,
      purpose: 'High risk capital injection and speculative expansion',
      repaymentFrequency: 'MONTHLY',
      status: 'DRAFT',
    },
    {
      firstName: 'Alexander',
      lastName: 'Hayes',
      email: 'customer@nexa.financial',
    }
  );

  await submitApplication(rejApp.id, 'user-officer-01');

  // Committee rejects application
  const rejected = await transitionApplicationStatus(
    rejApp.id,
    mockBranchManager,
    {
      targetStatus: 'REJECTED',
      notes: 'High debt service ratio (DSCR < 1.0) and unverified inventory assets',
    }
  );

  assert.strictEqual(rejected.status, 'REJECTED');
  assert.ok(rejected.rejectionReason, 'Rejection reason must be recorded');

  // Verify REJECTED is a terminal state with no allowed outbound transitions
  const allowedOutbound = ALLOWED_APPLICATION_TRANSITIONS.REJECTED;
  assert.deepStrictEqual(allowedOutbound, [], 'REJECTED must be a terminal state with zero outbound transitions');

  // Attempting to disburse or approve a rejected application must fail
  let illegalTransitionThrew = false;
  try {
    await transitionApplicationStatus(
      rejApp.id,
      mockBranchManager,
      {
        targetStatus: 'APPROVED',
        notes: 'Attempting to illegally approve rejected facility',
      }
    );
  } catch (err: any) {
    illegalTransitionThrew = true;
    assert.strictEqual(err.statusCode, 400);
  }
  assert.ok(illegalTransitionThrew, 'Transition from REJECTED to APPROVED must be rejected');
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Loans Lifecycle & Financial Calculations Tests Passed Successfully!\n`);
