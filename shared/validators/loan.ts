import { z } from 'zod';

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

export const ApplicationDocumentSchema = z.object({
  id: z.string().optional(),
  documentType: z.string().trim().min(2, 'Document type is required'),
  documentName: z.string().trim().min(2, 'Document name is required'),
  fileSize: z.string().optional(),
  fileUrl: z.string().min(1, 'File URL or content data is required'),
});

export const CreateLoanApplicationSchema = z.object({
  productId: z.string().trim().min(1, 'Please select a loan product'),
  principalAmount: z
    .number()
    .positive('Principal amount must be greater than zero')
    .max(10_000_000_000, 'Exceeds maximum allowable loan ceiling in TZS'),
  termMonths: z
    .number()
    .int('Term in months must be an integer')
    .min(1, 'Minimum loan term is 1 month')
    .max(360, 'Maximum loan term is 360 months'),
  repaymentFrequency: RepaymentFrequencySchema.default('MONTHLY'),
  purpose: z
    .string()
    .trim()
    .min(3, 'Please provide an articulated loan purpose (min 3 characters)')
    .max(1000, 'Loan purpose text cannot exceed 1000 characters'),
  status: z.enum(['DRAFT', 'SUBMITTED']).default('SUBMITTED').optional(),

  // Applicant detailed info
  employmentInfo: z
    .object({
      employerName: z.string().optional(),
      jobTitle: z.string().optional(),
      monthlyIncome: z.number().min(0).optional(),
      employmentType: z.string().optional(),
    })
    .optional(),
  bankDetails: z
    .object({
      bankName: z.string().optional(),
      accountNumber: z.string().optional(),
      accountName: z.string().optional(),
    })
    .optional(),
  guarantorInfo: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      relationship: z.string().optional(),
      guaranteedAmount: z.number().min(0).optional(),
    })
    .optional(),
  collateralInfo: z
    .object({
      type: z.string().optional(),
      estimatedValue: z.number().min(0).optional(),
      description: z.string().optional(),
    })
    .optional(),

  documents: z.array(ApplicationDocumentSchema).optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateLoanApplicationInput = z.infer<typeof CreateLoanApplicationSchema>;

export const UpdateLoanApplicationSchema = CreateLoanApplicationSchema.partial();
export type UpdateLoanApplicationInput = z.infer<typeof UpdateLoanApplicationSchema>;

export const AddApplicationNoteSchema = z.object({
  content: z.string().trim().min(2, 'Note content must be at least 2 characters').max(2000),
  type: z
    .enum(['INTERNAL_NOTE', 'INFO_REQUEST', 'RECOMMENDATION', 'ASSESSMENT', 'DECISION', 'REVISION_REQUEST'])
    .default('INTERNAL_NOTE'),
});
export type AddApplicationNoteInput = z.infer<typeof AddApplicationNoteSchema>;

export const RecommendApplicationSchema = z.object({
  recommendation: z.enum(['RECOMMEND_APPROVAL', 'RECOMMEND_REJECTION', 'REQUEST_INFO']),
  notes: z.string().trim().min(3, 'Recommendation notes are required (min 3 characters)'),
});
export type RecommendApplicationInput = z.infer<typeof RecommendApplicationSchema>;

export const CreditAssessmentSchema = z.object({
  creditScore: z.number().int().min(300).max(850).default(700),
  monthlyIncome: z.number().min(0, 'Monthly income cannot be negative'),
  monthlyDebtObligations: z.number().min(0, 'Monthly debt obligations cannot be negative').default(0),
  debtToIncomeRatio: z.number().min(0).max(100),
  riskRating: z.enum(['LOW', 'MEDIUM', 'MODERATE', 'HIGH', 'VERY_HIGH']).default('LOW'),
  maxRecommendedAmount: z.number().positive('Max recommended amount must be positive'),
  assessmentSummary: z.string().trim().min(5, 'Assessment summary is required (min 5 characters)'),
  decisionRecommendation: z
    .enum(['APPROVE', 'REJECT', 'REQUEST_ADDITIONAL_COLLATERAL'])
    .default('APPROVE'),
});
export type CreditAssessmentInput = z.infer<typeof CreditAssessmentSchema>;

export const TransitionApplicationStatusSchema = z.object({
  targetStatus: z.enum([
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CREDIT_ASSESSMENT',
    'APPROVED',
    'REJECTED',
    'REVISION_REQUESTED',
    'DISBURSED',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
  ]),
  notes: z.string().trim().max(1000).optional(),
  approvedAmount: z.number().positive().optional(),
  approvedTermMonths: z.number().int().min(1).optional(),
  approvedInterestRate: z.number().min(0).max(100).optional(),
  rejectionReason: z.string().trim().max(1000).optional(),
  revisionNotes: z.string().trim().max(1000).optional(),
  disbursementReference: z.string().trim().optional(),
  disbursementMethod: z
    .enum(['BANK_TRANSFER', 'MOBILE_MONEY', 'CASH', 'CHEQUE', 'ONLINE_CARD', 'OTHER'])
    .optional(),
  destinationAccount: z.string().trim().optional(),
});
export type TransitionApplicationStatusInput = z.infer<typeof TransitionApplicationStatusSchema>;

export const DisburseLoanSchema = z.object({
  disbursementReference: z.string().trim().min(3, 'Disbursement reference must be at least 3 characters'),
  amount: z.number().positive('Disbursement amount must be greater than zero'),
  disbursementDate: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER']),
  transactionReference: z.string().trim().min(3, 'Transaction reference is required (min 3 characters)'),
  channelDetails: z.string().trim().optional(),
  destinationAccount: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type DisburseLoanInput = z.infer<typeof DisburseLoanSchema>;

export const UpdateLoanStatusSchema = z.object({
  status: z.enum([
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'CREDIT_ASSESSMENT',
    'APPROVED',
    'REJECTED',
    'PENDING_DISBURSEMENT',
    'DISBURSED',
    'ACTIVE',
    'IN_ARREARS',
    'DELINQUENT',
    'DEFAULTED',
    'RESTRUCTURED',
    'CLOSED',
    'CLOSED_PAID_OFF',
    'COMPLETED',
    'WRITTEN_OFF',
  ]),
  reviewNotes: z
    .string()
    .trim()
    .min(3, 'Audit review justification must be provided')
    .max(1000, 'Review notes cannot exceed 1000 characters')
    .optional(),
});
export type UpdateLoanStatusInput = z.infer<typeof UpdateLoanStatusSchema>;

export const RecordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero'),
  method: z.enum([
    'ACH',
    'WIRE_TRANSFER',
    'DEBIT_CARD',
    'CHECK',
    'CASH',
    'BANK_TRANSFER',
    'MOBILE_MONEY',
    'CHEQUE',
    'ONLINE_CARD',
    'OTHER',
  ]),
  notes: z.string().max(255).optional(),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
