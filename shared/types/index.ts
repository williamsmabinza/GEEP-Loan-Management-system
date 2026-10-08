// ==============================================================================
// Nexa Loan Management System - Comprehensive Domain Contracts & DTOs
// ==============================================================================

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'BRANCH_MANAGER'
  | 'LOAN_OFFICER'
  | 'CREDIT_OFFICER'
  | 'UNDERWRITER'
  | 'CASHIER'
  | 'ACCOUNTANT'
  | 'COLLECTION_OFFICER'
  | 'CUSTOMER';

export type UserStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'INACTIVE'
  | 'LOCKED'
  | 'PENDING_VERIFICATION';

export type KycStatus =
  | 'NOT_SUBMITTED'
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export type ProfileStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'BLACKLISTED'
  | 'DECEASED';

export type LoanApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CREDIT_ASSESSMENT'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUESTED'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export type LoanStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING_DISBURSEMENT'
  | 'DISBURSED'
  | 'ACTIVE'
  | 'IN_ARREARS'
  | 'DELINQUENT'
  | 'DEFAULTED'
  | 'RESTRUCTURED'
  | 'CLOSED'
  | 'CLOSED_PAID_OFF'
  | 'WRITTEN_OFF';

export type RepaymentFrequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'BI_WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUALLY'
  | 'ANNUALLY'
  | 'BULLET_AT_MATURITY';

export type PaymentStatus =
  | 'SCHEDULED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'WAIVED';

export type PaymentMethod =
  | 'CASH'
  | 'BANK_TRANSFER'
  | 'MOBILE_MONEY'
  | 'CHEQUE'
  | 'ONLINE_CARD'
  | 'OTHER';

export type AuditAction = string;

// ------------------------------------------------------------------------------
// Standard API Envelope
// ------------------------------------------------------------------------------

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ------------------------------------------------------------------------------
// Organization & Staff DTOs
// ------------------------------------------------------------------------------

export interface BranchDTO {
  id: string;
  branchCode: string;
  name: string;
  city: string;
  state: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  status: string;
}

export interface StaffDTO {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  phone: string;
  branch?: BranchDTO;
}

// ------------------------------------------------------------------------------
// Customer & User DTOs
// ------------------------------------------------------------------------------

export type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'PROOF_OF_RESIDENCE'
  | 'PAYSLIP'
  | 'BANK_STATEMENT'
  | 'TAX_RETURN'
  | 'BUSINESS_REGISTRATION'
  | 'COLLATERAL_TITLE_DEED'
  | 'VEHICLE_LOGBOOK'
  | 'GUARANTOR_FORM'
  | 'LOAN_AGREEMENT'
  | 'CREDIT_REPORT'
  | 'OTHER';

export type DocumentVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface CustomerDocumentDTO {
  id: string;
  customerId: string;
  loanApplicationId?: string | null;
  loanId?: string | null;
  documentType: DocumentType;
  documentName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  verificationStatus: DocumentVerificationStatus;
  verifiedByStaffId?: string | null;
  verifiedByStaffName?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}

export interface CustomerFinancialSummaryDTO {
  totalLoans: number;
  activeLoans: number;
  completedLoans: number;
  totalBorrowed: number;
  totalRepaid: number;
  outstandingBalance: number;
  overdueBalance: number;
}

export interface CustomerDTO {
  id: string;
  customerNumber: string;
  userId?: string | null;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  email: string;
  phone: string;
  alternatePhone?: string | null;
  idType: string;
  idNumber: string;
  idIssueDate?: string | null;
  idExpiryDate?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
  employmentType: string;
  employerName?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  businessAddress?: string | null;
  monthlyIncome: number;
  creditScore?: number | null;
  emergencyContactName?: string | null;
  emergencyContactRelationship?: string | null;
  emergencyContactPhone?: string | null;
  profileStatus: ProfileStatus;
  kycStatus: KycStatus;
  branchId?: string;
  branch?: BranchDTO;
  photoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  financialSummary?: CustomerFinancialSummaryDTO;
  documents?: CustomerDocumentDTO[];
  loans?: LoanDTO[];
  payments?: PaymentTransactionDTO[];
}

export interface UserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  permissions?: string[];
  phoneNumber?: string | null;
  nationalId?: string | null;
  createdAt: string;
  customer?: CustomerDTO | null;
  staffProfile?: StaffDTO | null;
}

export interface LoginResponseData {
  user: UserDTO;
  token: string;
  refreshToken?: string;
  expiresIn: string;
}

// ------------------------------------------------------------------------------
// Loan & Product DTOs
// ------------------------------------------------------------------------------

export interface InterestRateTierDTO {
  id: string;
  tierName: string;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  rate: number;
  isActive: boolean;
}

export type InterestCalculationMethod =
  | 'FLAT_RATE'
  | 'REDUCING_BALANCE_EQUAL_INSTALLMENTS'
  | 'REDUCING_BALANCE_EQUAL_PRINCIPAL'
  | 'SIMPLE_INTEREST'
  | 'COMPOUND_INTEREST';

export interface LoanProductDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  minAmount: number;
  maxAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  baseInterestRate: number;
  interestCalculationMethod: InterestCalculationMethod | string;
  repaymentFrequency: RepaymentFrequency;
  processingFeeType?: 'PERCENTAGE_OF_PRINCIPAL' | 'FIXED_AMOUNT';
  processingFeeValue: number;
  insuranceFeeType?: 'PERCENTAGE_OF_PRINCIPAL' | 'FIXED_AMOUNT';
  insuranceFeeValue?: number;
  penaltyRate: number;
  penaltyType?: string;
  gracePeriodDays: number;
  principalGracePeriodMonths?: number;
  status?: string;
  isActive: boolean;
  tiers?: InterestRateTierDTO[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanCalculationScheduleItemDTO {
  installmentNumber: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  feesDue: number;
  totalDue: number;
  remainingBalance: number;
  status: 'SCHEDULED';
}

export interface LoanCalculationResultDTO {
  principal: number;
  annualRate: number;
  termMonths: number;
  numberOfInstallments: number;
  repaymentFrequency: RepaymentFrequency;
  interestCalculationMethod: InterestCalculationMethod;
  installmentAmount: number;
  totalInterest: number;
  processingFee: number;
  insuranceFee: number;
  totalFees: number;
  totalPayable: number;
  apr: number;
  schedule: LoanCalculationScheduleItemDTO[];
}

export type AllocationComponent = 'PENALTIES' | 'FEES' | 'INTEREST' | 'PRINCIPAL';

export type AllocationStrategy =
  | 'PENALTIES_FEES_INTEREST_PRINCIPAL'
  | 'FEES_PENALTIES_INTEREST_PRINCIPAL'
  | 'INTEREST_FEES_PENALTIES_PRINCIPAL'
  | 'PRINCIPAL_FIRST'
  | 'CUSTOM';

export type OverpaymentRule =
  | 'APPLY_TO_NEXT_INSTALLMENTS'
  | 'REDUCE_OUTSTANDING_PRINCIPAL'
  | 'HOLD_AS_UNALLOCATED_CREDIT';

export interface RepaymentScheduleDTO {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  feesDue: number;
  penaltyDue: number;
  totalDue: number;
  principalPaid: number;
  interestPaid: number;
  feesPaid?: number;
  penaltyPaid?: number;
  totalPaid: number;
  outstandingAmount: number;
  outstandingPrincipal?: number;
  outstandingInterest?: number;
  outstandingFees?: number;
  outstandingPenalty?: number;
  status: PaymentStatus;
  paidDate?: string | null;
}

export interface PaymentAllocationDTO {
  id: string;
  paymentId: string;
  repaymentScheduleId?: string;
  installmentNumber?: number;
  dueDate?: string;
  penaltyAllocated: number;
  feesAllocated: number;
  interestAllocated: number;
  principalAllocated: number;
  totalAllocated: number;
  allocatedAt: string;
}

export interface PaymentReceiptDTO {
  receiptNumber: string;
  paymentReference: string;
  transactionReference?: string | null;
  paymentDate: string;
  loanId: string;
  loanNumber: string;
  productName: string;
  customerId: string;
  customerName: string;
  customerNumber?: string;
  customerPhone?: string;
  amountPaid: number;
  currency: string;
  paymentMethod: PaymentMethod;
  allocation: {
    penalties: number;
    fees: number;
    interest: number;
    principal: number;
    overpayment: number;
  };
  allocationStrategy: AllocationStrategy;
  overpaymentRule?: OverpaymentRule;
  previousBalance: number;
  newBalance: number;
  remainingPrincipal: number;
  remainingInterest: number;
  remainingFees: number;
  remainingPenalties: number;
  nextInstallment?: {
    installmentNumber: number;
    dueDate: string;
    amountDue: number;
  } | null;
  receivedByStaffName: string;
  receivedByStaffRole?: string;
  notes?: string | null;
  isReversal?: boolean;
  issuedAt: string;
}

export interface PaymentTransactionDTO {
  id: string;
  paymentReference?: string;
  transactionRef: string;
  receiptNumber?: string;
  loanId: string;
  loanNumber?: string;
  customerId?: string;
  customerName?: string;
  customerNumber?: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  status: 'FULLY_ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED' | 'REVERSED';
  allocationStrategy?: AllocationStrategy;
  overpaymentRule?: OverpaymentRule;
  penaltyAllocated?: number;
  feesAllocated?: number;
  interestAllocated?: number;
  principalAllocated?: number;
  overpaymentAmount?: number;
  allocations?: PaymentAllocationDTO[];
  receipt?: PaymentReceiptDTO;
  notes?: string | null;
  isReversal?: boolean;
  reversedPaymentId?: string | null;
  reversalReason?: string | null;
  reversedAt?: string | null;
  reversedByStaffId?: string | null;
  reversedByStaffName?: string | null;
  receivedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    role?: string;
  } | null;
  createdAt?: string;
}

export interface CollateralDTO {
  id: string;
  collateralType: string;
  description: string;
  valuationAmount: number;
  pledgedAmount: number;
  status: string;
}

export interface LoanGuarantorDTO {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  guaranteedAmount: number;
  status: string;
}

export interface LoanDisbursementDTO {
  id: string;
  disbursementReference: string;
  loanId?: string;
  amount: number;
  disbursementDate: string;
  paymentMethod: PaymentMethod;
  transactionReference?: string | null;
  channelDetails?: string | null;
  destinationAccount?: string | null;
  disbursedByStaffId?: string | null;
  disbursedByStaffName?: string | null;
  notes?: string | null;
  status: string;
}

export interface CustomerLoanSummaryDTO {
  customerId: string;
  previousLoans: LoanDTO[];
  activeLoans: LoanDTO[];
  totalLoansCount: number;
  activeLoansCount: number;
  totalOutstandingBalance: number;
  totalOutstandingPrincipal: number;
  totalMonthlyDebtObligation: number;
}

export interface LoanDTO {
  id: string;
  loanNumber: string;
  customerId: string;
  customer?: CustomerDTO;
  // Backward compatibility alias for UI views
  borrowerId?: string;
  borrower?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string | null;
  };
  productId: string;
  product?: LoanProductDTO;
  branchId?: string;
  branch?: BranchDTO;
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  repaymentFrequency: RepaymentFrequency;
  totalInterest: number;
  totalPayable: number;
  monthlyInstallment: number;
  remainingBalance: number;
  totalPaidAmount: number;
  status: LoanStatus;
  purpose: string;
  notes?: string | null;
  applicationDate: string;
  approvedAt?: string | null;
  disbursedAt?: string | null;
  maturityDate?: string | null;
  closedAt?: string | null;
  reviewerId?: string | null;
  reviewer?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  reviewNotes?: string | null;
  repayments?: RepaymentScheduleDTO[];
  payments?: PaymentTransactionDTO[];
  collaterals?: CollateralDTO[];
  guarantors?: LoanGuarantorDTO[];
  disbursements?: LoanDisbursementDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationNoteDTO {
  id: string;
  applicationId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  type: 'INTERNAL_NOTE' | 'INFO_REQUEST' | 'RECOMMENDATION' | 'ASSESSMENT' | 'DECISION' | 'REVISION_REQUEST';
  content: string;
  createdAt: string;
}

export interface ApplicationDocumentDTO {
  id: string;
  applicationId: string;
  documentType: string;
  documentName: string;
  fileSize?: string;
  fileUrl: string;
  uploadedAt: string;
  verified?: boolean;
}

export interface CreditAssessmentDTO {
  assessedByStaffId: string;
  assessedByName: string;
  assessedAt: string;
  creditScore: number;
  monthlyIncome: number;
  monthlyDebtObligations: number;
  debtToIncomeRatio: number;
  riskRating: 'LOW' | 'MEDIUM' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  maxRecommendedAmount: number;
  assessmentSummary: string;
  decisionRecommendation: 'APPROVE' | 'REJECT' | 'REQUEST_ADDITIONAL_COLLATERAL';
}

export interface LoanApplicationDTO {
  id: string;
  applicationNumber: string;
  customerId: string;
  customer?: CustomerDTO;
  loanProductId: string;
  loanProduct?: LoanProductDTO;
  branchId?: string;
  branchName?: string;
  requestedAmount: number;
  requestedTermMonths: number;
  purpose: string;
  repaymentFrequency: RepaymentFrequency;
  status: LoanApplicationStatus;

  // Assigned Personnel
  loanOfficerId?: string | null;
  loanOfficerName?: string | null;
  creditOfficerId?: string | null;
  creditOfficerName?: string | null;

  // Borrower Supplied Info
  employmentInfo?: {
    employerName?: string;
    jobTitle?: string;
    monthlyIncome?: number;
    employmentType?: string;
  };
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
  guarantorInfo?: {
    name?: string;
    phone?: string;
    relationship?: string;
    guaranteedAmount?: number;
  };
  collateralInfo?: {
    type?: string;
    estimatedValue?: number;
    description?: string;
  };

  documents: ApplicationDocumentDTO[];
  notes: ApplicationNoteDTO[];
  creditAssessment?: CreditAssessmentDTO | null;

  // Recommendation
  recommendedByOfficerId?: string | null;
  recommendation?: 'RECOMMEND_APPROVAL' | 'RECOMMEND_REJECTION' | 'REQUEST_INFO' | null;
  recommendationNotes?: string | null;
  recommendedAt?: string | null;

  // Final Approval
  approvedAmount?: number | null;
  approvedTermMonths?: number | null;
  approvedInterestRate?: number | null;
  approvedByStaffId?: string | null;
  approvedByStaffName?: string | null;
  approvalDate?: string | null;
  approvalNotes?: string | null;

  // Rejection
  rejectionReason?: string | null;
  rejectionDate?: string | null;
  rejectedByStaffId?: string | null;

  // Disbursement & Active Loan Link
  disbursedAmount?: number | null;
  disbursedAt?: string | null;
  disbursementReference?: string | null;
  loanId?: string | null;
  loanNumber?: string | null;

  applicationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRolePermissionConfig {
  role: UserRole;
  canReview: boolean;
  canRequestInfo: boolean;
  canRecommend: boolean;
  canAssessCredit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDisburse: boolean;
  canClose: boolean;
  maxApprovalLimitTZS: number; // 0 means no limit or none
}

export interface WorkflowSettingsDTO {
  rolePermissions: WorkflowRolePermissionConfig[];
  requireDualApprovalAboveTZS: number;
  allowSelfApproval: boolean;
  autoAssignLoanOfficers: boolean;
  enforceDocumentChecklistBeforeAssessment: boolean;
}

export interface PortfolioAtRiskDTO {
  par30Amount: number;
  par30Ratio: number;
  par60Amount: number;
  par60Ratio: number;
  par90Amount: number;
  par90Ratio: number;
  totalAtRiskAmount: number;
  delinquencyRate: number;
  nplRatio: number;
}

export interface DashboardMetricStats {
  totalCustomers: number;
  activeLoans: number;
  pendingApplications: number;
  approvedLoans: number;
  disbursedAmount: number;
  totalRepayments: number;
  outstandingPortfolio: number;
  overdueAmount: number;
  completedLoans: number;
  par: PortfolioAtRiskDTO;
}

export interface DisbursementTrendPoint {
  period: string;
  amount: number;
  count: number;
}

export interface RepaymentTrendPoint {
  period: string;
  amount: number;
  principal: number;
  interest: number;
  count: number;
}

export interface ActiveVsCompletedDistribution {
  activeCount: number;
  activeVolume: number;
  inArrearsCount: number;
  inArrearsVolume: number;
  completedCount: number;
  completedVolume: number;
  pendingDisbursementCount: number;
  pendingDisbursementVolume: number;
}

export interface ProductPortfolioPoint {
  productId: string;
  productName: string;
  productCode: string;
  loanCount: number;
  outstandingBalance: number;
  disbursedAmount: number;
  percentageOfPortfolio: number;
}

export interface BranchPortfolioPoint {
  branchId: string;
  branchName: string;
  branchCode: string;
  activeLoans: number;
  outstandingBalance: number;
  disbursedAmount: number;
  overdueAmount: number;
  parRatio: number;
}

export interface OverdueAgingBracket {
  bracket: string;
  loanCount: number;
  overdueAmount: number;
  outstandingBalance: number;
}

export interface ApplicationTrendPoint {
  period: string;
  submitted: number;
  approved: number;
  rejected: number;
  underReview: number;
}

export interface DashboardOverdueLoanItem {
  id: string;
  loanNumber: string;
  customerName: string;
  customerPhone?: string;
  daysOverdue: number;
  overdueAmount: number;
  outstandingBalance: number;
  status: string;
  dueDate: string;
  productName: string;
  branchName?: string;
}

export interface DashboardCustomerItem {
  id: string;
  customerNumber: string;
  name: string;
  phone: string;
  email: string;
  branchName?: string;
  kycStatus: string;
  profileStatus: string;
  activeLoansCount: number;
  registeredAt: string;
}

export interface DashboardSummaryDTO {
  metrics: DashboardMetricStats;
  charts: {
    disbursementOverTime: DisbursementTrendPoint[];
    repaymentsOverTime: RepaymentTrendPoint[];
    activeVsCompleted: ActiveVsCompletedDistribution;
    portfolioByProduct: ProductPortfolioPoint[];
    portfolioByBranch: BranchPortfolioPoint[];
    overdueLoansAging: OverdueAgingBracket[];
    applicationTrends: ApplicationTrendPoint[];
  };
  tables: {
    recentApplications: LoanApplicationDTO[];
    recentPayments: PaymentTransactionDTO[];
    overdueLoans: DashboardOverdueLoanItem[];
    recentCustomers: DashboardCustomerItem[];
  };
  context: {
    authorizedBranches: Array<{ id: string; name: string; code: string }>;
    selectedBranchId: string;
    isBranchRestricted: boolean;
    userRole: string;
    lastUpdated: string;
  };
}

export interface LoanPortfolioStatsDTO {
  totalLoanCount: number;
  activeLoanCount: number;
  pendingReviewCount: number;
  totalDisbursedVolume: number;
  totalOutstandingBalance: number;
  totalCollections: number;
  delinquencyRate: number;
}

// ------------------------------------------------------------------------------
// Audit Log DTO
// ------------------------------------------------------------------------------

export interface AuditLogDTO {
  id: string;
  userId: string | null;
  userEmail?: string | null;
  userFullName?: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  timestamp: string;
}

// ------------------------------------------------------------------------------
// Health DTO
// ------------------------------------------------------------------------------

export interface DatabaseHealthInfo {
  status: 'connected' | 'degraded' | 'disconnected';
  engine: 'MySQL';
  host: string;
  port: number;
  database: string;
  connectionPoolActive: boolean;
  latencyMs: number;
}

export interface SystemHealthDTO {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
  environment: string;
  database: DatabaseHealthInfo;
  features: {
    jwtAuth: boolean;
    rbac: boolean;
    auditLog: boolean;
    zodValidation: boolean;
    prismaOrm: boolean;
    relationalEntitiesCount: number;
  };
}

// ------------------------------------------------------------------------------
// Comprehensive Reporting Module Types
// ------------------------------------------------------------------------------

export type ReportType =
  | 'LOAN_PORTFOLIO'
  | 'LOAN_APPLICATIONS'
  | 'LOAN_DISBURSEMENTS'
  | 'REPAYMENTS'
  | 'OUTSTANDING_BALANCES'
  | 'OVERDUE_LOANS'
  | 'CUSTOMER_REPORT'
  | 'LOAN_PRODUCT_PERFORMANCE'
  | 'BRANCH_PERFORMANCE'
  | 'STAFF_PERFORMANCE'
  | 'COLLECTION_PERFORMANCE'
  | 'INCOME_FROM_INTEREST'
  | 'FEES_COLLECTED'
  | 'PENALTIES_COLLECTED';

export interface ReportColumnConfig {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  isCurrency?: boolean;
  isDate?: boolean;
  isNumeric?: boolean;
  isBadge?: boolean;
}

export interface ReportFilterOptionsDTO {
  branches: Array<{ id: string; name: string; code: string }>;
  products: Array<{ id: string; name: string; code: string }>;
  loanStatuses: string[];
  applicationStatuses: string[];
  staffMembers: Array<{ id: string; name: string; role: string; department?: string }>;
  customers?: Array<{ id: string; name: string; customerNumber: string }>;
  isBranchRestricted: boolean;
  userBranchId?: string;
}

export interface ReportFilterParams {
  reportType: ReportType;
  startDate?: string;
  endDate?: string;
  branchId?: string;
  productId?: string;
  status?: string;
  customerId?: string;
  staffId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReportResponseDTO<T = any> {
  reportType: ReportType;
  title: string;
  description: string;
  generatedAt: string;
  filtersApplied: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
    branchName?: string;
    productId?: string;
    productName?: string;
    status?: string;
    customerId?: string;
    staffId?: string;
    search?: string;
  };
  summary: Record<string, number | string>;
  columns: ReportColumnConfig[];
  rows: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
  };
}

// ------------------------------------------------------------------------------
// Notification Architecture Types
// ------------------------------------------------------------------------------

export type NotificationEventType =
  | 'LOAN_APPLICATION_SUBMITTED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'ADDITIONAL_INFO_REQUESTED'
  | 'LOAN_DISBURSED'
  | 'UPCOMING_REPAYMENT'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REVERSED'
  | 'LOAN_OVERDUE'
  | 'LOAN_COMPLETED';

export type NotificationChannelType = 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH';

export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'READ';

export interface NotificationDTO {
  id: string;
  userId: string;
  userName?: string;
  customerId?: string | null;
  customerName?: string | null;
  eventType: NotificationEventType;
  channel: NotificationChannelType;
  subject: string;
  message: string;
  status: NotificationDeliveryStatus;
  metadata?: Record<string, any>;
  readAt?: string | null;
  sentAt: string;
  createdAt: string;
}

export interface NotificationTemplateDTO {
  id: string;
  eventType: NotificationEventType;
  channel: NotificationChannelType;
  subjectTemplate: string;
  bodyTemplate: string;
  enabled: boolean;
  variables: string[];
  description: string;
}

export interface NotificationTypeRuleDTO {
  eventType: NotificationEventType;
  name: string;
  description: string;
  enabled: boolean;
  channels: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
  rolesNotified: string[];
}

export interface SmsProviderConfigDTO {
  providerId: 'NEXT_SMS' | 'BEEM_SMS' | 'TWILIO' | 'GENERIC_WEBHOOK' | 'SANDBOX';
  providerName: string;
  senderId: string;
  apiKey?: string;
  apiSecret?: string;
  endpointUrl?: string;
  isConfigured: boolean;
  sandboxMode: boolean;
}

export interface EmailProviderConfigDTO {
  providerId: 'SMTP' | 'SENDGRID' | 'POSTMARK' | 'SANDBOX';
  providerName: string;
  fromEmail: string;
  fromName: string;
  apiKey?: string;
  host?: string;
  port?: number;
  isConfigured: boolean;
  sandboxMode: boolean;
}

export interface NotificationSystemSettingsDTO {
  rules: NotificationTypeRuleDTO[];
  templates: NotificationTemplateDTO[];
  smsProvider: SmsProviderConfigDTO;
  emailProvider: EmailProviderConfigDTO;
  channelsGlobalEnabled: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
  };
}

export interface SendNotificationPayload {
  eventType: NotificationEventType;
  recipientUserId?: string;
  recipientCustomerId?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  templateData: Record<string, any>;
  channelsOverride?: NotificationChannelType[];
  forceSend?: boolean;
}
