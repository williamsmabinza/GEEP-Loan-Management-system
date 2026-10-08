import assert from 'node:assert/strict';
import {
  calculateLoan,
  getPeriodsPerYear,
  calculateNumberOfInstallments,
  calculateDueDate,
  calculateFees,
} from '../server/services/loan-calculator.service.js';
import Decimal from 'decimal.js';

console.log('🧪 Starting Loan Calculator Financial Arithmetic Unit Tests...\n');

let totalTests = 0;
let passedTests = 0;

function test(description: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------------
// Test Group 1: Decimal-Safe Fee Calculations
// ----------------------------------------------------------------------------
console.log('--- Group 1: Decimal-Safe Fee Calculations ---');

test('Percentage fee calculation with non-trivial decimals ($123,456.78 at 1.75%)', () => {
  const principal = new Decimal('123456.78');
  const fee = calculateFees(principal, 'PERCENTAGE_OF_PRINCIPAL', 1.75);
  // 123456.78 * 0.0175 = 2160.49365 -> 2160.49
  assert.equal(fee.toNumber(), 2160.49);
});

test('Fixed fee calculation', () => {
  const principal = new Decimal('50000');
  const fee = calculateFees(principal, 'FIXED_AMOUNT', 350.50);
  assert.equal(fee.toNumber(), 350.50);
});

test('Zero fee when not configured', () => {
  const principal = new Decimal('50000');
  const fee = calculateFees(principal, undefined, 0);
  assert.equal(fee.toNumber(), 0);
});

// ----------------------------------------------------------------------------
// Test Group 2: Periods & Frequency Mapping
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Periods & Frequency Mapping ---');

test('Periods per year standard values', () => {
  assert.equal(getPeriodsPerYear('DAILY'), 365);
  assert.equal(getPeriodsPerYear('WEEKLY'), 52);
  assert.equal(getPeriodsPerYear('BI_WEEKLY'), 26);
  assert.equal(getPeriodsPerYear('MONTHLY'), 12);
  assert.equal(getPeriodsPerYear('QUARTERLY'), 4);
});

test('Installment count for 12 months at different frequencies', () => {
  assert.equal(calculateNumberOfInstallments(12, 'MONTHLY'), 12);
  assert.equal(calculateNumberOfInstallments(12, 'QUARTERLY'), 4);
  assert.equal(calculateNumberOfInstallments(12, 'WEEKLY'), 52);
  assert.equal(calculateNumberOfInstallments(12, 'BI_WEEKLY'), 26);
  assert.equal(calculateNumberOfInstallments(12, 'DAILY'), 360);
});

// ----------------------------------------------------------------------------
// Test Group 3: Reducing Balance Equal Installments (Amortization)
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Reducing Balance Equal Installments (French Amortization) ---');

test('Standard $10,000 at 12% annual rate for 12 months', () => {
  const result = calculateLoan({
    principal: 10000,
    annualRate: 12,
    termMonths: 12,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
    processingFeeValue: 0,
    insuranceFeeValue: 0,
  });

  // Monthly installment should be approximately $888.49
  assert.equal(result.installmentAmount, 888.49);
  assert.equal(result.numberOfInstallments, 12);
  assert.equal(result.schedule.length, 12);

  // Exact principal balance check: Sum of principal dues MUST equal exact initial principal ($10,000)
  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 10000);

  // Remaining balance after final installment MUST be exactly 0
  assert.equal(result.schedule[11].remainingBalance, 0);

  // Total interest should be approximately 661.85 (sum of scheduled interests)
  const expectedTotalInterest = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.interestDue).toNumber(),
    0
  );
  assert.equal(result.totalInterest, expectedTotalInterest);

  // Total payable must equal Principal + Total Interest
  assert.equal(result.totalPayable, 10000 + result.totalInterest);
});

test('Zero interest rate amortization ($12,000 at 0% for 12 months)', () => {
  const result = calculateLoan({
    principal: 12000,
    annualRate: 0,
    termMonths: 12,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
  });

  assert.equal(result.installmentAmount, 1000);
  assert.equal(result.totalInterest, 0);
  assert.equal(result.totalPayable, 12000);
  assert.equal(result.schedule[11].remainingBalance, 0);
});

// ----------------------------------------------------------------------------
// Test Group 4: Flat Rate Calculation Method
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Flat Rate Calculation Method ---');

test('Flat rate $20,000 at 10% for 24 months (2 years)', () => {
  const result = calculateLoan({
    principal: 20000,
    annualRate: 10,
    termMonths: 24,
    interestCalculationMethod: 'FLAT_RATE',
    repaymentFrequency: 'MONTHLY',
  });

  // Flat Interest = 20,000 * 0.10 * 2 = 4,000
  assert.equal(result.totalInterest, 4000);
  assert.equal(result.totalPayable, 24000);
  assert.equal(result.numberOfInstallments, 24);

  // Each installment = (20,000 + 4,000) / 24 = 1,000
  assert.equal(result.installmentAmount, 1000);

  // Sum of principal dues must be exactly 20,000
  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 20000);
  assert.equal(result.schedule[23].remainingBalance, 0);
});

// ----------------------------------------------------------------------------
// Test Group 5: Reducing Balance Equal Principal Method
// ----------------------------------------------------------------------------
console.log('\n--- Group 5: Reducing Balance Equal Principal Method ---');

test('Equal Principal $12,000 at 12% for 12 months', () => {
  const result = calculateLoan({
    principal: 12000,
    annualRate: 12,
    termMonths: 12,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_PRINCIPAL',
    repaymentFrequency: 'MONTHLY',
  });

  // Fixed principal per installment = 1,000
  assert.equal(result.schedule[0].principalDue, 1000);
  assert.equal(result.schedule[5].principalDue, 1000);
  assert.equal(result.schedule[11].principalDue, 1000);

  // Month 1 interest: 12,000 * 0.01 = 120 -> Total 1,120
  assert.equal(result.schedule[0].interestDue, 120);
  assert.equal(result.schedule[0].totalDue, 1120);

  // Month 12 interest: 1,000 * 0.01 = 10 -> Total 1,010
  assert.equal(result.schedule[11].interestDue, 10);
  assert.equal(result.schedule[11].totalDue, 1010);

  // Total remaining balance at end must be 0
  assert.equal(result.schedule[11].remainingBalance, 0);
});

// ----------------------------------------------------------------------------
// Test Group 6: Quarterly and Bi-Weekly Frequencies
// ----------------------------------------------------------------------------
console.log('\n--- Group 6: Quarterly and Bi-Weekly Frequencies ---');

test('Quarterly Amortization ($50,000 at 8% for 24 months = 8 quarters)', () => {
  const result = calculateLoan({
    principal: 50000,
    annualRate: 8,
    termMonths: 24,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'QUARTERLY',
  });

  assert.equal(result.numberOfInstallments, 8);
  assert.equal(result.schedule.length, 8);
  assert.equal(result.schedule[7].remainingBalance, 0);

  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 50000);
});

test('Bi-Weekly Amortization ($15,000 at 9.5% for 12 months = 26 installments)', () => {
  const result = calculateLoan({
    principal: 15000,
    annualRate: 9.5,
    termMonths: 12,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'BI_WEEKLY',
  });

  assert.equal(result.numberOfInstallments, 26);
  assert.equal(result.schedule.length, 26);
  assert.equal(result.schedule[25].remainingBalance, 0);

  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 15000);
});

// ----------------------------------------------------------------------------
// Test Group 7: Fee Integration & Total Payable
// ----------------------------------------------------------------------------
console.log('\n--- Group 7: Fee Integration & Total Payable ---');

test('Loan with 1.5% Processing Fee and 0.5% Insurance Fee', () => {
  const result = calculateLoan({
    principal: 100000,
    annualRate: 10,
    termMonths: 12,
    interestCalculationMethod: 'FLAT_RATE',
    repaymentFrequency: 'MONTHLY',
    processingFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    processingFeeValue: 1.5,
    insuranceFeeType: 'PERCENTAGE_OF_PRINCIPAL',
    insuranceFeeValue: 0.5,
  });

  // Processing fee: 100,000 * 1.5% = 1,500
  assert.equal(result.processingFee, 1500);
  // Insurance fee: 100,000 * 0.5% = 500
  assert.equal(result.insuranceFee, 500);
  assert.equal(result.totalFees, 2000);

  // Interest: 100,000 * 10% * 1 = 10,000
  assert.equal(result.totalInterest, 10000);

  // Total payable: 100,000 + 10,000 + 2,000 = 112,000
  assert.equal(result.totalPayable, 112000);
});

// ----------------------------------------------------------------------------
// Test Group 8: Simple Interest Method
// ----------------------------------------------------------------------------
console.log('\n--- Group 8: Simple Interest Method ---');

test('Simple interest $30,000 at 6% for 18 months (1.5 years)', () => {
  const result = calculateLoan({
    principal: 30000,
    annualRate: 6,
    termMonths: 18,
    interestCalculationMethod: 'SIMPLE_INTEREST',
    repaymentFrequency: 'MONTHLY',
  });

  // Simple Interest = 30,000 * 0.06 * 1.5 = 2,700
  assert.equal(result.totalInterest, 2700);
  assert.equal(result.totalPayable, 32700);
  assert.equal(result.numberOfInstallments, 18);

  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 30000);
  assert.equal(result.schedule[17].remainingBalance, 0);
});

// ----------------------------------------------------------------------------
// Test Group 9: Daily and Weekly Frequencies
// ----------------------------------------------------------------------------
console.log('\n--- Group 9: Daily and Weekly Frequencies ---');

test('Daily repayment for 1 month ($3,000 at 12%)', () => {
  const result = calculateLoan({
    principal: 3000,
    annualRate: 12,
    termMonths: 1,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'DAILY',
  });

  assert.equal(result.numberOfInstallments, 30);
  assert.equal(result.schedule.length, 30);
  assert.equal(result.schedule[29].remainingBalance, 0);

  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 3000);
});

test('Weekly repayment for 6 months = 26 weeks ($6,500 at 10%)', () => {
  const result = calculateLoan({
    principal: 6500,
    annualRate: 10,
    termMonths: 6,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'WEEKLY',
  });

  assert.equal(result.numberOfInstallments, 26);
  assert.equal(result.schedule.length, 26);
  assert.equal(result.schedule[25].remainingBalance, 0);

  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 6500);
});

// ----------------------------------------------------------------------------
// Test Group 10: High-Precision Fractional Cents & Zero Precision Drift
// ----------------------------------------------------------------------------
console.log('\n--- Group 10: High-Precision Fractional Cents & Zero Precision Drift ---');

test('Non-standard principal and rate ($77,777.77 at 13.33% for 7 months)', () => {
  const result = calculateLoan({
    principal: 77777.77,
    annualRate: 13.33,
    termMonths: 7,
    interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: 'MONTHLY',
  });

  assert.equal(result.numberOfInstallments, 7);
  assert.equal(result.schedule.length, 7);

  // Remaining balance after the final installment MUST be exactly 0
  assert.equal(result.schedule[6].remainingBalance, 0);

  // Sum of principal dues MUST equal the exact non-trivial principal down to the cent
  const sumPrincipal = result.schedule.reduce(
    (acc, item) => new Decimal(acc).plus(item.principalDue).toNumber(),
    0
  );
  assert.equal(sumPrincipal, 77777.77);

  // Total payable must exactly equal Principal + Total Interest
  const expectedPayable = new Decimal('77777.77').plus(result.totalInterest).toNumber();
  assert.equal(result.totalPayable, expectedPayable);
});

test('Due date month-end rollover (Jan 31 rolls over to Feb 28)', () => {
  const jan31 = new Date('2026-01-31T00:00:00.000Z');
  const febDate = calculateDueDate(jan31, 1, 'MONTHLY');
  // February has 28 days in 2026
  assert.equal(febDate.getDate(), 28);
  assert.equal(febDate.getMonth(), 1); // 1 = February (0-indexed)
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Financial Calculation Tests Passed Successfully!\n`);
