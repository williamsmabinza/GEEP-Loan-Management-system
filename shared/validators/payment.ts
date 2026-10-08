import { z } from 'zod';

export const AllocationStrategySchema = z.enum([
  'PENALTIES_FEES_INTEREST_PRINCIPAL',
  'FEES_PENALTIES_INTEREST_PRINCIPAL',
  'INTEREST_FEES_PENALTIES_PRINCIPAL',
  'PRINCIPAL_FIRST',
  'CUSTOM',
]);

export const OverpaymentRuleSchema = z.enum([
  'APPLY_TO_NEXT_INSTALLMENTS',
  'REDUCE_OUTSTANDING_PRINCIPAL',
  'HOLD_AS_UNALLOCATED_CREDIT',
]);

export const AllocationComponentSchema = z.enum([
  'PENALTIES',
  'FEES',
  'INTEREST',
  'PRINCIPAL',
]);

export const CreatePaymentSchema = z.object({
  loanId: z.string().min(1, 'Loan ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z
    .enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'ONLINE_CARD', 'OTHER'])
    .default('BANK_TRANSFER'),
  paymentReference: z.string().trim().optional(),
  transactionReference: z.string().trim().optional(),
  paymentDate: z.string().trim().optional(),
  allocationStrategy: AllocationStrategySchema.default('PENALTIES_FEES_INTEREST_PRINCIPAL'),
  customAllocationPriority: z.array(AllocationComponentSchema).optional(),
  overpaymentRule: OverpaymentRuleSchema.default('APPLY_TO_NEXT_INSTALLMENTS'),
  notes: z.string().trim().optional(),
});

export type CreatePaymentInput = z.input<typeof CreatePaymentSchema>;
export type CreatePaymentData = z.infer<typeof CreatePaymentSchema>;

export const ReversePaymentSchema = z.object({
  reason: z.string().trim().min(5, 'Reversal reason must be provided (min 5 characters)'),
});

export type ReversePaymentInput = z.infer<typeof ReversePaymentSchema>;

