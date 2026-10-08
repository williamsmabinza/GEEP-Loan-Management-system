import Decimal from 'decimal.js';
import {
  InterestCalculationMethod,
  RepaymentFrequency,
  LoanCalculationResultDTO,
  LoanCalculationScheduleItemDTO,
} from '../../shared/types/index.js';
import { CalculateLoanInput } from '../../shared/validators/product.js';

// Configure Decimal.js for high-precision institutional banking math
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
});

export interface LoanCalculationOptions extends CalculateLoanInput {}

/**
 * Returns periods per calendar year for standard banking intervals
 */
export function getPeriodsPerYear(frequency: RepaymentFrequency): number {
  switch (frequency) {
    case 'DAILY':
      return 365;
    case 'WEEKLY':
      return 52;
    case 'BI_WEEKLY':
      return 26;
    case 'MONTHLY':
      return 12;
    case 'QUARTERLY':
      return 4;
    case 'SEMI_ANNUALLY':
      return 2;
    case 'ANNUALLY':
      return 1;
    case 'BULLET_AT_MATURITY':
      return 1;
    default:
      return 12;
  }
}

/**
 * Converts term in months to exact number of installment payments based on frequency
 */
export function calculateNumberOfInstallments(
  termMonths: number,
  frequency: RepaymentFrequency
): number {
  switch (frequency) {
    case 'DAILY':
      return Math.max(1, termMonths * 30);
    case 'WEEKLY':
      return Math.max(1, Math.round((termMonths * 52) / 12));
    case 'BI_WEEKLY':
      return Math.max(1, Math.round((termMonths * 26) / 12));
    case 'MONTHLY':
      return Math.max(1, termMonths);
    case 'QUARTERLY':
      return Math.max(1, Math.round(termMonths / 3));
    case 'SEMI_ANNUALLY':
      return Math.max(1, Math.round(termMonths / 6));
    case 'ANNUALLY':
      return Math.max(1, Math.round(termMonths / 12));
    case 'BULLET_AT_MATURITY':
      return 1;
    default:
      return Math.max(1, termMonths);
  }
}

/**
 * Calculate due dates with calendar-correct month and leap-year awareness
 */
export function calculateDueDate(
  startDate: Date,
  installmentIndex: number,
  frequency: RepaymentFrequency
): Date {
  const result = new Date(startDate);
  switch (frequency) {
    case 'DAILY':
      result.setDate(result.getDate() + installmentIndex);
      break;
    case 'WEEKLY':
      result.setDate(result.getDate() + installmentIndex * 7);
      break;
    case 'BI_WEEKLY':
      result.setDate(result.getDate() + installmentIndex * 14);
      break;
    case 'MONTHLY': {
      const targetMonth = result.getMonth() + installmentIndex;
      const originalDay = result.getDate();
      result.setMonth(targetMonth);
      // Handle end of month rollover (e.g., Jan 31 -> Feb 28)
      if (result.getDate() !== originalDay) {
        result.setDate(0);
      }
      break;
    }
    case 'QUARTERLY': {
      const targetMonth = result.getMonth() + installmentIndex * 3;
      const originalDay = result.getDate();
      result.setMonth(targetMonth);
      if (result.getDate() !== originalDay) {
        result.setDate(0);
      }
      break;
    }
    case 'SEMI_ANNUALLY': {
      const targetMonth = result.getMonth() + installmentIndex * 6;
      const originalDay = result.getDate();
      result.setMonth(targetMonth);
      if (result.getDate() !== originalDay) {
        result.setDate(0);
      }
      break;
    }
    case 'ANNUALLY':
      result.setFullYear(result.getFullYear() + installmentIndex);
      break;
    case 'BULLET_AT_MATURITY':
      result.setMonth(result.getMonth() + installmentIndex);
      break;
  }
  return result;
}

/**
 * Decimal-safe Fee Calculator
 */
export function calculateFees(
  principalDec: Decimal,
  feeType?: 'PERCENTAGE_OF_PRINCIPAL' | 'FIXED_AMOUNT',
  feeValue?: number
): Decimal {
  if (!feeValue || feeValue <= 0) return new Decimal(0);
  const valDec = new Decimal(feeValue);
  if (feeType === 'FIXED_AMOUNT') {
    return valDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  // Percentage of principal: Principal * (feeValue / 100)
  return principalDec
    .times(valDec)
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Institutional Loan Calculator Service (Decimal-safe arithmetic)
 */
export function calculateLoan(options: LoanCalculationOptions): LoanCalculationResultDTO {
  const principal = new Decimal(options.principal);
  const annualRate = new Decimal(options.annualRate);
  const termMonths = options.termMonths;
  const frequency = options.repaymentFrequency || 'MONTHLY';
  const method: InterestCalculationMethod =
    options.interestCalculationMethod || 'REDUCING_BALANCE_EQUAL_INSTALLMENTS';

  const periodsPerYear = getPeriodsPerYear(frequency);
  const numInstallments = calculateNumberOfInstallments(termMonths, frequency);

  // Periodic interest rate i = (annualRate / 100) / periodsPerYear
  const periodicRate = annualRate
    .dividedBy(100)
    .dividedBy(periodsPerYear);

  // Fees calculation
  const processingFee = calculateFees(
    principal,
    options.processingFeeType,
    options.processingFeeValue
  );
  const insuranceFee = calculateFees(
    principal,
    options.insuranceFeeType,
    options.insuranceFeeValue
  );
  const totalFees = processingFee.plus(insuranceFee);

  const schedule: LoanCalculationScheduleItemDTO[] = [];
  const baseDate = options.startDate ? new Date(options.startDate) : new Date();

  let totalInterest = new Decimal(0);
  let installmentAmount = new Decimal(0);

  // Apply Calculation Method
  if (method === 'FLAT_RATE') {
    // Total Interest = Principal * (annualRate / 100) * (termMonths / 12)
    const termYears = new Decimal(termMonths).dividedBy(12);
    totalInterest = principal
      .times(annualRate.dividedBy(100))
      .times(termYears)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const basePrincipalPerInst = principal
      .dividedBy(numInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const baseInterestPerInst = totalInterest
      .dividedBy(numInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    let remainingPrincipal = new Decimal(principal);
    let remainingInterest = new Decimal(totalInterest);

    for (let k = 1; k <= numInstallments; k++) {
      const isLast = k === numInstallments;
      const principalDue = isLast ? remainingPrincipal : basePrincipalPerInst;
      const interestDue = isLast ? remainingInterest : baseInterestPerInst;
      const totalDue = principalDue.plus(interestDue);

      remainingPrincipal = remainingPrincipal.minus(principalDue);
      remainingInterest = remainingInterest.minus(interestDue);

      const dueDate = calculateDueDate(baseDate, k, frequency);

      schedule.push({
        installmentNumber: k,
        dueDate: dueDate.toISOString(),
        principalDue: principalDue.toNumber(),
        interestDue: interestDue.toNumber(),
        feesDue: 0,
        totalDue: totalDue.toNumber(),
        remainingBalance: Math.max(0, remainingPrincipal.toNumber()),
        status: 'SCHEDULED',
      });
    }

    installmentAmount = schedule[0] ? new Decimal(schedule[0].totalDue) : new Decimal(0);
  } else if (
    method === 'REDUCING_BALANCE_EQUAL_INSTALLMENTS' ||
    method === 'COMPOUND_INTEREST'
  ) {
    // Standard Amortized PMT = P * [i * (1 + i)^N] / [(1 + i)^N - 1]
    let pmt: Decimal;
    if (periodicRate.isZero()) {
      pmt = principal.dividedBy(numInstallments);
    } else {
      const onePlusI = new Decimal(1).plus(periodicRate);
      const factor = onePlusI.pow(numInstallments);
      const numerator = principal.times(periodicRate).times(factor);
      const denominator = factor.minus(1);
      pmt = numerator.dividedBy(denominator);
    }

    const roundedPmt = pmt.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    installmentAmount = roundedPmt;

    let remainingPrincipal = new Decimal(principal);

    for (let k = 1; k <= numInstallments; k++) {
      const isLast = k === numInstallments;
      const interestDue = remainingPrincipal
        .times(periodicRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      let principalDue: Decimal;
      if (isLast) {
        principalDue = remainingPrincipal;
      } else {
        principalDue = roundedPmt.minus(interestDue);
        if (principalDue.greaterThan(remainingPrincipal)) {
          principalDue = remainingPrincipal;
        }
      }

      const totalDue = principalDue.plus(interestDue);
      remainingPrincipal = remainingPrincipal.minus(principalDue);
      totalInterest = totalInterest.plus(interestDue);

      const dueDate = calculateDueDate(baseDate, k, frequency);

      schedule.push({
        installmentNumber: k,
        dueDate: dueDate.toISOString(),
        principalDue: principalDue.toNumber(),
        interestDue: interestDue.toNumber(),
        feesDue: 0,
        totalDue: totalDue.toNumber(),
        remainingBalance: Math.max(0, remainingPrincipal.toNumber()),
        status: 'SCHEDULED',
      });
    }
  } else if (method === 'REDUCING_BALANCE_EQUAL_PRINCIPAL') {
    // Equal principal per period: Principal / N
    const basePrincipalPerInst = principal
      .dividedBy(numInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    let remainingPrincipal = new Decimal(principal);

    for (let k = 1; k <= numInstallments; k++) {
      const isLast = k === numInstallments;
      const interestDue = remainingPrincipal
        .times(periodicRate)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      const principalDue = isLast ? remainingPrincipal : basePrincipalPerInst;
      const totalDue = principalDue.plus(interestDue);

      remainingPrincipal = remainingPrincipal.minus(principalDue);
      totalInterest = totalInterest.plus(interestDue);

      const dueDate = calculateDueDate(baseDate, k, frequency);

      schedule.push({
        installmentNumber: k,
        dueDate: dueDate.toISOString(),
        principalDue: principalDue.toNumber(),
        interestDue: interestDue.toNumber(),
        feesDue: 0,
        totalDue: totalDue.toNumber(),
        remainingBalance: Math.max(0, remainingPrincipal.toNumber()),
        status: 'SCHEDULED',
      });
    }

    installmentAmount = schedule[0] ? new Decimal(schedule[0].totalDue) : new Decimal(0);
  } else if (method === 'SIMPLE_INTEREST') {
    // Simple Interest = Principal * (annualRate / 100) * (termMonths / 12)
    const termYears = new Decimal(termMonths).dividedBy(12);
    totalInterest = principal
      .times(annualRate.dividedBy(100))
      .times(termYears)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    const basePrincipalPerInst = principal
      .dividedBy(numInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const baseInterestPerInst = totalInterest
      .dividedBy(numInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    let remainingPrincipal = new Decimal(principal);
    let remainingInterest = new Decimal(totalInterest);

    for (let k = 1; k <= numInstallments; k++) {
      const isLast = k === numInstallments;
      const principalDue = isLast ? remainingPrincipal : basePrincipalPerInst;
      const interestDue = isLast ? remainingInterest : baseInterestPerInst;
      const totalDue = principalDue.plus(interestDue);

      remainingPrincipal = remainingPrincipal.minus(principalDue);
      remainingInterest = remainingInterest.minus(interestDue);

      const dueDate = calculateDueDate(baseDate, k, frequency);

      schedule.push({
        installmentNumber: k,
        dueDate: dueDate.toISOString(),
        principalDue: principalDue.toNumber(),
        interestDue: interestDue.toNumber(),
        feesDue: 0,
        totalDue: totalDue.toNumber(),
        remainingBalance: Math.max(0, remainingPrincipal.toNumber()),
        status: 'SCHEDULED',
      });
    }

    installmentAmount = schedule[0] ? new Decimal(schedule[0].totalDue) : new Decimal(0);
  }

  const totalPayable = principal
    .plus(totalInterest)
    .plus(totalFees)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Approximate APR calculation including fees
  const apr =
    principal.greaterThan(0) && termMonths > 0
      ? totalInterest
          .plus(totalFees)
          .dividedBy(principal)
          .dividedBy(termMonths)
          .times(12)
          .times(100)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
          .toNumber()
      : annualRate.toNumber();

  return {
    principal: principal.toNumber(),
    annualRate: annualRate.toNumber(),
    termMonths,
    numberOfInstallments: numInstallments,
    repaymentFrequency: frequency,
    interestCalculationMethod: method,
    installmentAmount: installmentAmount.toNumber(),
    totalInterest: totalInterest.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
    processingFee: processingFee.toNumber(),
    insuranceFee: insuranceFee.toNumber(),
    totalFees: totalFees.toNumber(),
    totalPayable: totalPayable.toNumber(),
    apr,
    schedule,
  };
}
