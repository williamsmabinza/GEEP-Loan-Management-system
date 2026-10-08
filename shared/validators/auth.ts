import { z } from 'zod';

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please provide a valid corporate or personal email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters long')
    .max(100, 'Password exceeds allowable length'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please provide a valid corporate or personal email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z
    .string()
    .trim()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name too long'),
  lastName: z
    .string()
    .trim()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name too long'),
  phoneNumber: z
    .string()
    .trim()
    .min(7, 'Phone number must be at least 7 digits')
    .optional(),
  nationalId: z
    .string()
    .trim()
    .min(4, 'National ID / SSN required for credit assessment')
    .optional(),
  annualIncome: z
    .number()
    .min(0, 'Annual income cannot be negative')
    .optional(),
  employmentStatus: z
    .string()
    .optional(),
  employerName: z
    .string()
    .optional(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(10, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const ChangePasswordSchema = z.object({
  oldPassword: z
    .string()
    .min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Please provide a valid email address'),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z
    .string()
    .min(10, 'Password reset token is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const UpdateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE', 'LOCKED']),
  reason: z
    .string()
    .trim()
    .min(3, 'Audit reason must be provided')
    .max(255, 'Reason cannot exceed 255 characters'),
});

export type UpdateUserStatusInput = z.infer<typeof UpdateUserStatusSchema>;

export const CreateUserByAdminSchema = z.object({
  email: z.string().trim().email('Valid email required'),
  password: z.string().min(8, 'Minimum 8 characters'),
  role: z.enum([
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
    'CREDIT_OFFICER',
    'UNDERWRITER',
    'CASHIER',
    'ACCOUNTANT',
    'COLLECTION_OFFICER',
    'CUSTOMER',
  ]),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  phone: z.string().min(5),
  branchId: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
});

export type CreateUserByAdminInput = z.infer<typeof CreateUserByAdminSchema>;
