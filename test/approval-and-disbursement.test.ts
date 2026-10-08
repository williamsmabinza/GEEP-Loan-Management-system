import assert from 'node:assert/strict';
import {
  createApprovedLoanRecord,
  disburseLoanFacility,
  getCustomerLoanSummary,
  memoryLoans,
  getAllLoans,
} from '../server/services/loans.service.js';
import {
  transitionApplicationStatus,
  disburseApplication,
  getApplicationById,
  getAllApplications,
  ALLOWED_APPLICATION_TRANSITIONS,
} from '../server/services/applications.service.js';
import { LoanApplicationDTO, UserRole } from '../shared/types/index.js';

console.log('🧪 Starting Loan Approval & Disbursement Automated Test Suite...\n');

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

const mockStaffOfficer = {
  userId: 'staff-credit-01',
  role: 'CREDIT_OFFICER' as UserRole,
  firstName: 'Marcus',
  lastName: 'Vance',
};

const mockCashier = {
  userId: 'staff-cashier-01',
  role: 'CASHIER' as UserRole,
  firstName: 'Sarah',
  lastName: 'Mwamburi',
};

const mockCustomerActor = {
  userId: 'user-cust-01',
  role: 'CUSTOMER' as UserRole,
  firstName: 'Alexander',
  lastName: 'Hayes',
};

// ----------------------------------------------------------------------------
// Test Group 1: Approval Workflow & Loan Record Generation
// ----------------------------------------------------------------------------
console.log('--- Group 1: Approval Workflow & Actuarial Loan Record Generation ---');

await testAsync('Approving application generates loan record with correct calculations and PENDING_DISBURSEMENT status', async () => {
  // Use demo application app-2026-001
  const app = await getApplicationById('app-2026-001');
  assert.ok(app, 'Demo application should exist');

  const approvedAmount = 15000000; // 15M TZS
  const approvedTermMonths = 12;
  const approvedRate = 12.0; // 12% APR

  const loan = await createApprovedLoanRecord(
    app,
    approvedAmount,
    approvedTermMonths,
    approvedRate,
    mockStaffOfficer,
    'Approved by Credit Committee based on clean cash flow and KYC verification'
  );

  assert.ok(loan, 'Loan record should be created');
  assert.ok(loan.loanNumber.startsWith('LN-2026-'), 'Loan number should follow standard sequence format');
  assert.equal(loan.principalAmount, approvedAmount, 'Principal amount must equal approved amount');
  assert.equal(loan.interestRate, approvedRate, 'Interest rate must equal approved rate');
  assert.equal(loan.termMonths, approvedTermMonths, 'Term months must equal approved term');

  // Actuarial Financial Calculations Validation
  assert.ok(loan.totalInterest > 0, 'Total interest expected must be greater than zero');
  assert.ok(loan.totalPayable > loan.principalAmount, 'Total payable must exceed principal amount');
  // Principal + interest + fees = total payable
  const expectedPayable = Number((loan.principalAmount + loan.totalInterest + 300000).toFixed(2));
  assert.equal(
    loan.totalPayable,
    expectedPayable,
    'Total payable must equal principal + total interest + processing fees'
  );
  assert.ok(loan.monthlyInstallment > 0, 'Monthly installment must be positive');
  assert.equal(loan.remainingBalance, loan.totalPayable, 'Initial remaining balance must equal total payable');
  assert.equal(loan.totalPaidAmount, 0, 'Initial total paid amount must be 0 prior to repayment');

  // Schedule & Maturity Date Validation
  assert.ok(loan.maturityDate, 'Maturity date must be calculated');
  assert.ok(loan.repayments && loan.repayments.length === approvedTermMonths, 'Repayments schedule must have 12 installments');
  assert.ok(
    loan.repayments[loan.repayments.length - 1].dueDate.includes(loan.maturityDate.split('T')[0]),
    'Final installment due date must match facility maturity date'
  );

  // CRITICAL REQUIREMENT: Do not mark a loan as Active until disbursement has been recorded!
  assert.equal(
    loan.status,
    'PENDING_DISBURSEMENT',
    'Loan MUST NOT be marked as ACTIVE upon approval; must be PENDING_DISBURSEMENT'
  );
});

await testAsync('Transitioning application status to APPROVED creates linked loan and updates application fields', async () => {
  // Use app-2026-002 which is in CREDIT_ASSESSMENT
  const app = await getApplicationById('app-2026-002');
  assert.ok(app, 'Application app-2026-002 should exist');

  const updatedApp = await transitionApplicationStatus('app-2026-002', mockStaffOfficer, {
    targetStatus: 'APPROVED',
    approvedAmount: 40000000, // 40M TZS
    approvedTermMonths: 24,
    approvedInterestRate: 11.5,
    notes: 'Approved by underwriting committee with commercial asset debenture.',
  });

  assert.equal(updatedApp.status, 'APPROVED', 'Application status must be APPROVED');
  assert.equal(updatedApp.approvedAmount, 40000000, 'Approved amount must be recorded on application');
  assert.equal(updatedApp.approvedTermMonths, 24, 'Approved term must be recorded');
  assert.equal(updatedApp.approvedInterestRate, 11.5, 'Approved rate must be recorded');
  assert.ok(updatedApp.approvalDate, 'Approval date must be recorded');
  assert.equal(updatedApp.approvedByStaffId, mockStaffOfficer.userId, 'Approved by staff ID must be recorded');
  assert.ok(updatedApp.loanId, 'Loan ID must be linked to application');
  assert.ok(updatedApp.loanNumber, 'Loan number must be linked to application');

  // Check generated loan in memory loans
  const createdLoan = memoryLoans.find((l) => l.id === updatedApp.loanId);
  assert.ok(createdLoan, 'Generated loan must exist in master ledger');
  assert.equal(createdLoan.status, 'PENDING_DISBURSEMENT', 'Generated loan must be PENDING_DISBURSEMENT');
});

// ----------------------------------------------------------------------------
// Test Group 2: Rejection Requirements & Validation
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Rejection Requirements & Validation ---');

await testAsync('Rejection fails if reason/comment is omitted', async () => {
  let thrown = false;
  try {
    // Attempt rejection with empty reason
    await transitionApplicationStatus('app-2026-003', mockStaffOfficer, {
      targetStatus: 'REJECTED',
      rejectionReason: '   ', // whitespace only
      notes: '',
    });
  } catch (err: any) {
    thrown = true;
    assert.ok(
      err.message.includes('required') || err.message.includes('reason'),
      'Error message should indicate reason is required'
    );
  }
  assert.ok(thrown, 'Transitioning to REJECTED without comment must throw an error');
});

await testAsync('Rejection succeeds with articulated reason and logs rejection metadata', async () => {
  const reasonText = 'High debt-to-income ratio (58%) exceeds regulatory ceiling of 40%.';
  const updated = await transitionApplicationStatus('app-2026-003', mockStaffOfficer, {
    targetStatus: 'REJECTED',
    rejectionReason: reasonText,
    notes: reasonText,
  });

  assert.equal(updated.status, 'REJECTED', 'Status must transition to REJECTED');
  assert.equal(updated.rejectionReason, reasonText, 'Rejection reason must be stored');
  assert.ok(updated.rejectionDate, 'Rejection date must be recorded');
});

// ----------------------------------------------------------------------------
// Test Group 3: Request Revision Workflow
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Request Revision Workflow ---');

await testAsync('Allowed transitions includes REVISION_REQUESTED for UNDER_REVIEW and CREDIT_ASSESSMENT', () => {
  assert.ok(
    ALLOWED_APPLICATION_TRANSITIONS.UNDER_REVIEW.includes('REVISION_REQUESTED'),
    'UNDER_REVIEW must allow REVISION_REQUESTED'
  );
  assert.ok(
    ALLOWED_APPLICATION_TRANSITIONS.CREDIT_ASSESSMENT.includes('REVISION_REQUESTED'),
    'CREDIT_ASSESSMENT must allow REVISION_REQUESTED'
  );
  assert.ok(
    ALLOWED_APPLICATION_TRANSITIONS.REVISION_REQUESTED.includes('UNDER_REVIEW') ||
    ALLOWED_APPLICATION_TRANSITIONS.REVISION_REQUESTED.includes('SUBMITTED'),
    'REVISION_REQUESTED must allow resubmission'
  );
});

await testAsync('Requesting revision requires comments and transitions status to REVISION_REQUESTED', async () => {
  // Use app-2026-001 (move to UNDER_REVIEW first if needed)
  const app = await getApplicationById('app-2026-001');
  app.status = 'UNDER_REVIEW';

  let threwEmpty = false;
  try {
    await transitionApplicationStatus('app-2026-001', mockStaffOfficer, {
      targetStatus: 'REVISION_REQUESTED',
      revisionNotes: '',
    });
  } catch {
    threwEmpty = true;
  }
  assert.ok(threwEmpty, 'Request revision without explanation must throw an error');

  const revisionComment = 'Please provide audited financial statements for FY2025 and updated CRDB bank statements.';
  const updated = await transitionApplicationStatus('app-2026-001', mockStaffOfficer, {
    targetStatus: 'REVISION_REQUESTED',
    revisionNotes: revisionComment,
    notes: revisionComment,
  });

  assert.equal(updated.status, 'REVISION_REQUESTED', 'Status must be REVISION_REQUESTED');
});

// ----------------------------------------------------------------------------
// Test Group 4: Disbursement Workflow & Supported Payment Channels
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Disbursement Workflow & Payment Channels (Cash, Bank, Mobile, Other) ---');

await testAsync('Disbursement via BANK_TRANSFER records reference, method, and transitions loan to ACTIVE', async () => {
  // First ensure application is in APPROVED state
  const app = await getApplicationById('app-2026-001');
  app.status = 'CREDIT_ASSESSMENT';

  const approvedApp = await transitionApplicationStatus('app-2026-001', mockStaffOfficer, {
    targetStatus: 'APPROVED',
    approvedAmount: 18000000, // 18M TZS
    approvedTermMonths: 12,
    approvedInterestRate: 12.0,
    notes: 'Facility approved for commercial inventory expansion.',
  });

  const loanId = approvedApp.loanId!;
  const loanBefore = memoryLoans.find((l) => l.id === loanId)!;
  assert.equal(loanBefore.status, 'PENDING_DISBURSEMENT', 'Loan must be PENDING_DISBURSEMENT before disbursement');

  // Execute Disbursement via Bank Transfer
  const disbResult = await disburseLoanFacility(loanId, mockCashier, {
    disbursementReference: 'DSB-2026-0091',
    amount: 18000000,
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'CRDB-TISS-8849201',
    channelDetails: 'CRDB Bank Commercial Settlement Desk',
    destinationAccount: '0150248920100',
    notes: 'Released via direct commercial wire',
  });

  assert.ok(disbResult, 'Disbursement result should be returned');
  assert.equal(disbResult.disbursement.paymentMethod, 'BANK_TRANSFER', 'Payment method must be BANK_TRANSFER');
  assert.equal(disbResult.disbursement.disbursementReference, 'DSB-2026-0091', 'Disbursement reference must match');
  assert.equal(disbResult.disbursement.transactionReference, 'CRDB-TISS-8849201', 'Transaction reference must match');
  assert.equal(disbResult.disbursement.amount, 18000000, 'Disbursed amount must match');
  assert.equal(disbResult.disbursement.disbursedByStaffId, mockCashier.userId, 'Processed by staff ID must be recorded');

  // CRITICAL: Loan is NOW ACTIVE!
  assert.equal(disbResult.loan.status, 'ACTIVE', 'Loan status must transition to ACTIVE after disbursement');
  assert.ok(disbResult.loan.disbursedAt, 'Disbursement timestamp must be recorded on loan');
});

await testAsync('Disbursement via MOBILE_MONEY (M-Pesa / Airtel Money / Tigo Pesa)', async () => {
  // Set up an approved loan
  const app = await getApplicationById('app-2026-002');
  app.status = 'CREDIT_ASSESSMENT';

  const approvedApp = await transitionApplicationStatus('app-2026-002', mockStaffOfficer, {
    targetStatus: 'APPROVED',
    approvedAmount: 5000000, // 5M TZS
    approvedTermMonths: 6,
    approvedInterestRate: 10.0,
  });

  const loanId = approvedApp.loanId!;
  const disbResult = await disburseLoanFacility(loanId, mockCashier, {
    disbursementReference: 'DSB-MPESA-2026-044',
    amount: 5000000,
    paymentMethod: 'MOBILE_MONEY',
    transactionReference: 'MPESA-QDX99281',
    channelDetails: 'Vodacom M-Pesa B2C Corporate Bulk Disbursement',
    destinationAccount: '+255 784 990 011',
    notes: 'Direct B2C mobile money disbursement',
  });

  assert.equal(disbResult.disbursement.paymentMethod, 'MOBILE_MONEY', 'Method must be MOBILE_MONEY');
  assert.equal(disbResult.disbursement.transactionReference, 'MPESA-QDX99281', 'M-Pesa reference must be preserved');
  assert.equal(disbResult.loan.status, 'ACTIVE', 'Loan must be ACTIVE');
});

await testAsync('Disbursement via CASH at branch cashier vault', async () => {
  const app = await getApplicationById('app-2026-001');
  app.status = 'CREDIT_ASSESSMENT';

  const approvedApp = await transitionApplicationStatus('app-2026-001', mockStaffOfficer, {
    targetStatus: 'APPROVED',
    approvedAmount: 2000000, // 2M TZS
    approvedTermMonths: 3,
    approvedInterestRate: 14.0,
  });

  const disbResult = await disburseLoanFacility(approvedApp.loanId!, mockCashier, {
    disbursementReference: 'DSB-CASH-2026-001',
    amount: 2000000,
    paymentMethod: 'CASH',
    transactionReference: 'CSH-VOUCHER-0881',
    channelDetails: 'Dar es Salaam Central Cashier Vault #2',
    destinationAccount: 'Cash In Hand Over Counter',
    notes: 'Physical cash disbursed upon signing physical receipt',
  });

  assert.equal(disbResult.disbursement.paymentMethod, 'CASH', 'Payment method must be CASH');
  assert.equal(disbResult.loan.status, 'ACTIVE', 'Loan must transition to ACTIVE');
});

await testAsync('Disbursement via OTHER commercial clearing channel', async () => {
  const app = await getApplicationById('app-2026-001');
  app.status = 'CREDIT_ASSESSMENT';

  const approvedApp = await transitionApplicationStatus('app-2026-001', mockStaffOfficer, {
    targetStatus: 'APPROVED',
    approvedAmount: 10000000,
    approvedTermMonths: 12,
    approvedInterestRate: 12.0,
  });

  const disbResult = await disburseLoanFacility(approvedApp.loanId!, mockCashier, {
    disbursementReference: 'DSB-OTHER-2026-99',
    amount: 10000000,
    paymentMethod: 'OTHER',
    transactionReference: 'CLEARING-DRAFT-8819',
    notes: 'Bankers Cheque draft issued',
  });

  assert.equal(disbResult.disbursement.paymentMethod, 'OTHER', 'Payment method must be OTHER');
  assert.equal(disbResult.loan.status, 'ACTIVE', 'Loan must transition to ACTIVE');
});

// ----------------------------------------------------------------------------
// Test Group 5: Disbursement Integrity & Guardrails
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Disbursement Guardrails & Audit Validation ---');

await testAsync('Attempting to disburse an already ACTIVE loan throws error', async () => {
  // Find an active loan
  const activeLoan = memoryLoans.find((l) => l.status === 'ACTIVE');
  assert.ok(activeLoan, 'Active loan should exist');

  let failed = false;
  try {
    await disburseLoanFacility(activeLoan.id, mockCashier, {
      disbursementReference: 'DSB-DUP-01',
      amount: activeLoan.principalAmount,
      paymentMethod: 'BANK_TRANSFER',
      transactionReference: 'TXN-DUP-01',
    });
  } catch (err: any) {
    failed = true;
    assert.ok(err.message.includes('ACTIVE') || err.message.includes('disbursed'));
  }
  assert.ok(failed, 'Disbursing an already active loan must fail');
});

await testAsync('Customer loan summary properly aggregates previous loans and active debt obligations', async () => {
  const summary = await getCustomerLoanSummary('cust-01');

  assert.ok(summary, 'Summary should be generated');
  assert.equal(summary.customerId, 'cust-01', 'Customer ID must match');
  assert.ok(summary.totalLoansCount >= 1, 'Total loan count must be positive');
  assert.ok(summary.totalOutstandingBalance >= 0, 'Total outstanding balance must be numeric');
  assert.ok(summary.totalMonthlyDebtObligation >= 0, 'Total monthly debt obligation must be numeric');
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Approval & Disbursement Tests Passed Successfully!\n`);
