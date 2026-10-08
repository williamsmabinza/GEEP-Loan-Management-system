import { z } from 'zod';

export const CreateCustomerSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is required (min 2 chars)'),
  lastName: z.string().trim().min(2, 'Last name is required (min 2 chars)'),
  middleName: z.string().trim().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be YYYY-MM-DD').optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).default('PREFER_NOT_TO_SAY'),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED']).default('SINGLE'),
  email: z.string().trim().email('Valid email address is required'),
  phone: z.string().trim().min(7, 'Valid contact phone number is required'),
  alternatePhone: z.string().trim().optional(),
  idType: z.enum(['NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTER_ID', 'TAX_IDENTIFICATION_NUMBER', 'OTHER']).default('NATIONAL_ID'),
  idNumber: z.string().trim().min(4, 'Identification number is required'),
  addressLine1: z.string().trim().min(3, 'Address is required'),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State/Province is required'),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().default('US'),
  employmentType: z.enum([
    'FULL_TIME_SALARIED',
    'PART_TIME_SALARIED',
    'SELF_EMPLOYED',
    'BUSINESS_OWNER',
    'CONTRACTOR',
    'RETIRED',
    'UNEMPLOYED',
  ]).default('FULL_TIME_SALARIED'),
  employerName: z.string().trim().optional(),
  monthlyIncome: z.number().min(0, 'Monthly income cannot be negative'),
  creditScore: z.number().int().min(300).max(850).optional(),
  branchId: z.string().optional(),
  jobTitle: z.string().trim().optional(),
  businessName: z.string().trim().optional(),
  businessAddress: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactRelationship: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
  photoUrl: z.string().trim().url().optional().or(z.literal('')),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = CreateCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export const UpdateCustomerStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED', 'DECEASED']),
  reason: z.string().trim().min(3, 'Audit reason must be provided (min 3 chars)'),
});
export type UpdateCustomerStatusInput = z.infer<typeof UpdateCustomerStatusSchema>;

export const UpdateKycStatusSchema = z.object({
  kycStatus: z.enum(['NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED']),
  notes: z.string().trim().min(3, 'Verification review notes required'),
});
export type UpdateKycStatusInput = z.infer<typeof UpdateKycStatusSchema>;

export const AddCustomerDocumentSchema = z.object({
  documentType: z.enum([
    'NATIONAL_ID',
    'PASSPORT',
    'PROOF_OF_RESIDENCE',
    'PAYSLIP',
    'BANK_STATEMENT',
    'TAX_RETURN',
    'BUSINESS_REGISTRATION',
    'COLLATERAL_TITLE_DEED',
    'VEHICLE_LOGBOOK',
    'GUARANTOR_FORM',
    'LOAN_AGREEMENT',
    'CREDIT_REPORT',
    'OTHER',
  ]),
  documentName: z.string().trim().min(2, 'Document title is required'),
  fileUrl: z.string().trim().min(5, 'Valid file URL or storage path is required'),
  fileSizeBytes: z.number().int().positive().optional().default(1024),
  mimeType: z.string().optional().default('application/pdf'),
  loanApplicationId: z.string().optional(),
  loanId: z.string().optional(),
});
export type AddCustomerDocumentInput = z.infer<typeof AddCustomerDocumentSchema>;

export const VerifyCustomerDocumentSchema = z.object({
  verificationStatus: z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED']),
  rejectionReason: z.string().optional(),
});
export type VerifyCustomerDocumentInput = z.infer<typeof VerifyCustomerDocumentSchema>;

