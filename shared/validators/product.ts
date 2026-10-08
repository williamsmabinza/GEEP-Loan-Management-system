import { z } from 'zod';

export const InterestCalculationMethodSchema = z.enum([
  'FLAT_RATE',
  'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
  'REDUCING_BALANCE_EQUAL_PRINCIPAL',
  'SIMPLE_INTEREST',
  'COMPOUND_INTEREST',
]);

export const RepaymentFrequencySchema = z.enum([
  'DAILY',
  'WEEKLY',
  'BI_WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMI_ANNUALLY',
  'ANNUALLY',
  'BULLET_AT_MATURITY',
]);

export const FeeTypeSchema = z.enum(['PERCENTAGE_OF_PRINCIPAL', 'FIXED_AMOUNT']);

export const ProductStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

export const CreateLoanProductSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, 'Product code is required (min 2 chars)')
      .max(50, 'Product code max length is 50 chars')
      .regex(/^[A-Z0-9_-]+$/, 'Product code must be uppercase letters, numbers, hyphens or underscores'),
    name: z.string().trim().min(3, 'Product name is required (min 3 chars)').max(140),
    description: z.string().trim().optional(),
    minAmount: z.number().positive('Minimum loan amount must be positive'),
    maxAmount: z.number().positive('Maximum loan amount must be positive'),
    minTermMonths: z.number().int().min(1, 'Minimum term must be at least 1 month'),
    maxTermMonths: z.number().int().min(1, 'Maximum term must be at least 1 month'),
    baseInterestRate: z
      .number()
      .min(0, 'Interest rate cannot be negative')
      .max(100, 'Interest rate cannot exceed 100%'),
    interestCalculationMethod: InterestCalculationMethodSchema.default('REDUCING_BALANCE_EQUAL_INSTALLMENTS'),
    repaymentFrequency: RepaymentFrequencySchema.default('MONTHLY'),

    // Fees
    processingFeeType: FeeTypeSchema.default('PERCENTAGE_OF_PRINCIPAL'),
    processingFeeValue: z.number().min(0, 'Processing fee cannot be negative').default(0),
    insuranceFeeType: FeeTypeSchema.default('PERCENTAGE_OF_PRINCIPAL'),
    insuranceFeeValue: z.number().min(0, 'Insurance fee cannot be negative').default(0),

    // Grace Period & Penalties
    gracePeriodDays: z.number().int().min(0, 'Grace period days cannot be negative').default(5),
    principalGracePeriodMonths: z.number().int().min(0).default(0),
    penaltyRate: z.number().min(0, 'Penalty rate cannot be negative').default(5.0),
    penaltyType: z
      .enum(['LATE_PAYMENT', 'DEFAULT', 'DISHONOURED_PAYMENT', 'COVENANT_BREACH'])
      .default('LATE_PAYMENT'),

    status: ProductStatusSchema.default('ACTIVE'),
  })
  .refine((data) => data.maxAmount >= data.minAmount, {
    message: 'Maximum loan amount must be greater than or equal to minimum loan amount',
    path: ['maxAmount'],
  })
  .refine((data) => data.maxTermMonths >= data.minTermMonths, {
    message: 'Maximum term must be greater than or equal to minimum term',
    path: ['maxTermMonths'],
  });

export type CreateLoanProductInput = z.infer<typeof CreateLoanProductSchema>;

export const UpdateLoanProductSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[A-Z0-9_-]+$/)
      .optional(),
    name: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().optional(),
    minAmount: z.number().positive().optional(),
    maxAmount: z.number().positive().optional(),
    minTermMonths: z.number().int().min(1).optional(),
    maxTermMonths: z.number().int().min(1).optional(),
    baseInterestRate: z.number().min(0).max(100).optional(),
    interestCalculationMethod: InterestCalculationMethodSchema.optional(),
    repaymentFrequency: RepaymentFrequencySchema.optional(),
    processingFeeType: FeeTypeSchema.optional(),
    processingFeeValue: z.number().min(0).optional(),
    insuranceFeeType: FeeTypeSchema.optional(),
    insuranceFeeValue: z.number().min(0).optional(),
    gracePeriodDays: z.number().int().min(0).optional(),
    principalGracePeriodMonths: z.number().int().min(0).optional(),
    penaltyRate: z.number().min(0).optional(),
    penaltyType: z
      .enum(['LATE_PAYMENT', 'DEFAULT', 'DISHONOURED_PAYMENT', 'COVENANT_BREACH'])
      .optional(),
    status: ProductStatusSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.minAmount !== undefined && data.maxAmount !== undefined) {
        return data.maxAmount >= data.minAmount;
      }
      return true;
    },
    {
      message: 'Maximum loan amount must be greater than or equal to minimum loan amount',
      path: ['maxAmount'],
    }
  )
  .refine(
    (data) => {
      if (data.minTermMonths !== undefined && data.maxTermMonths !== undefined) {
        return data.maxTermMonths >= data.minTermMonths;
      }
      return true;
    },
    {
      message: 'Maximum term must be greater than or equal to minimum term',
      path: ['maxTermMonths'],
    }
  );

export type UpdateLoanProductInput = z.infer<typeof UpdateLoanProductSchema>;

export const ToggleProductStatusSchema = z.object({
  status: ProductStatusSchema,
});
export type ToggleProductStatusInput = z.infer<typeof ToggleProductStatusSchema>;

export const CalculateLoanSchema = z.object({
  principal: z.number().positive('Principal amount must be positive'),
  annualRate: z.number().min(0, 'Annual interest rate cannot be negative').max(100),
  termMonths: z.number().int().min(1, 'Term in months must be at least 1'),
  interestCalculationMethod: InterestCalculationMethodSchema.default(
    'REDUCING_BALANCE_EQUAL_INSTALLMENTS'
  ),
  repaymentFrequency: RepaymentFrequencySchema.default('MONTHLY'),
  processingFeeType: FeeTypeSchema.default('PERCENTAGE_OF_PRINCIPAL').optional(),
  processingFeeValue: z.number().min(0).default(0).optional(),
  insuranceFeeType: FeeTypeSchema.default('PERCENTAGE_OF_PRINCIPAL').optional(),
  insuranceFeeValue: z.number().min(0).default(0).optional(),
  startDate: z.string().optional(),
  gracePeriodDays: z.number().int().min(0).default(0).optional(),
  principalGracePeriodMonths: z.number().int().min(0).default(0).optional(),
});

export type CalculateLoanInput = z.infer<typeof CalculateLoanSchema>;
