import { prisma, isDatabaseConnected } from '../db/prisma.js';
import {
  LoanApplicationDTO,
  LoanApplicationStatus,
  ApplicationDocumentDTO,
  ApplicationNoteDTO,
  CreditAssessmentDTO,
  UserRole,
  BranchDTO,
} from '../../shared/types/index.js';
import {
  CreateLoanApplicationInput,
  UpdateLoanApplicationInput,
  TransitionApplicationStatusInput,
  CreditAssessmentInput,
  RecommendApplicationInput,
  AddApplicationNoteInput,
  DisburseLoanInput,
} from '../../shared/validators/loan.js';
import { AppError } from '../middleware/errorHandler.js';
import { recordAuditLog } from './audit.service.js';
import { calculateLoan } from './loan-calculator.service.js';
import { getAllLoanProducts } from './products.service.js';
import {
  createApprovedLoanRecord,
  disburseLoanFacility,
  getCustomerLoanSummary,
  memoryLoans,
} from './loans.service.js';
import { dispatchNotification } from './notification.service.js';
import { logger } from '../utils/logger.js';

// Strict State Transition Matrix
export const ALLOWED_APPLICATION_TRANSITIONS: Record<LoanApplicationStatus, LoanApplicationStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED', 'CANCELLED', 'REVISION_REQUESTED'],
  UNDER_REVIEW: ['CREDIT_ASSESSMENT', 'REJECTED', 'REVISION_REQUESTED', 'SUBMITTED'],
  CREDIT_ASSESSMENT: ['APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'UNDER_REVIEW'],
  APPROVED: ['DISBURSED', 'REJECTED', 'CANCELLED'],
  REJECTED: [], // Terminal decision
  REVISION_REQUESTED: ['SUBMITTED', 'UNDER_REVIEW', 'CANCELLED'],
  DISBURSED: ['ACTIVE'],
  ACTIVE: ['COMPLETED'],
  COMPLETED: [], // Terminal
  CANCELLED: [], // Terminal
};

const DEFAULT_BRANCH_DTO: BranchDTO = {
  id: 'br-dar-01',
  branchCode: 'DAR-01',
  name: 'Dar es Salaam Central',
  city: 'Dar es Salaam',
  state: 'Dar es Salaam',
  country: 'Tanzania',
  status: 'ACTIVE',
};

// Seed demo applications in memory
const DEMO_APPLICATIONS: LoanApplicationDTO[] = [
  {
    id: 'app-2026-001',
    applicationNumber: 'APP-2026-0042',
    customerId: 'cust-01',
    customer: {
      id: 'cust-01',
      customerNumber: 'CUST-2026-0001',
      firstName: 'Alexander',
      lastName: 'Hayes',
      email: 'customer@nexa.financial',
      phone: '+255 712 345 678',
      idType: 'NATIONAL_ID',
      idNumber: 'TZ-1988-100234',
      employmentType: 'FULL_TIME_SALARIED',
      monthlyIncome: 8500000,
      creditScore: 745,
      profileStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
      branch: DEFAULT_BRANCH_DTO,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    loanProductId: 'prod-sme-01',
    loanProduct: {
      id: 'prod-sme-01',
      code: 'PROD_SME_WORKING_CAPITAL',
      name: 'Commercial Working Capital Facility',
      description: 'Revolving liquidity and capital expansion facility for registered enterprise corporations.',
      minAmount: 5000000,
      maxAmount: 500000000,
      minTermMonths: 6,
      maxTermMonths: 36,
      baseInterestRate: 8.75,
      interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
      repaymentFrequency: 'MONTHLY',
      processingFeeValue: 1.5,
      penaltyRate: 5.0,
      gracePeriodDays: 5,
      isActive: true,
    },
    branchId: 'br-dar-01',
    branchName: 'Dar es Salaam Central',
    requestedAmount: 50000000, // 50M TZS
    requestedTermMonths: 24,
    purpose: 'Warehouse automation and logistics inventory expansion in Dar es Salaam port corridor.',
    repaymentFrequency: 'MONTHLY',
    status: 'ACTIVE',
    loanOfficerId: 'staff-off-01',
    loanOfficerName: 'Marcus Vance',
    creditOfficerId: 'staff-cred-01',
    creditOfficerName: 'Elena Rostova',
    employmentInfo: {
      employerName: 'Apex Logistics Tanzania Ltd',
      jobTitle: 'Managing Director & Founder',
      monthlyIncome: 8500000,
      employmentType: 'BUSINESS_OWNER',
    },
    bankDetails: {
      bankName: 'CRDB Bank Plc',
      accountNumber: '0150248920100',
      accountName: 'Apex Logistics Tanzania Ltd',
    },
    guarantorInfo: {
      name: 'Robert Vance Sterling',
      phone: '+255 754 112 233',
      relationship: 'Business Partner',
      guaranteedAmount: 25000000,
    },
    collateralInfo: {
      type: 'Commercial Real Estate',
      estimatedValue: 120000000,
      description: 'Logistics Warehouse plot No. 44B, Kurasini Industrial Area, Dar es Salaam',
    },
    documents: [
      {
        id: 'doc-app-01',
        applicationId: 'app-2026-001',
        documentType: 'Business License',
        documentName: 'BRELA_Certificate_Apex_Logistics.pdf',
        fileSize: '1.4 MB',
        fileUrl: '/uploads/brela_cert.pdf',
        uploadedAt: '2026-01-10T09:00:00.000Z',
        verified: true,
      },
      {
        id: 'doc-app-02',
        applicationId: 'app-2026-001',
        documentType: 'Bank Statement',
        documentName: 'CRDB_6Mo_Audited_Statement.pdf',
        fileSize: '3.8 MB',
        fileUrl: '/uploads/crdb_stmt.pdf',
        uploadedAt: '2026-01-10T09:15:00.000Z',
        verified: true,
      },
      {
        id: 'doc-app-03',
        applicationId: 'app-2026-001',
        documentType: 'Collateral Title Deed',
        documentName: 'Title_Deed_Kurasini_Warehouse.pdf',
        fileSize: '2.1 MB',
        fileUrl: '/uploads/title_deed.pdf',
        uploadedAt: '2026-01-10T09:20:00.000Z',
        verified: true,
      },
    ],
    notes: [
      {
        id: 'note-01',
        applicationId: 'app-2026-001',
        authorId: 'staff-off-01',
        authorName: 'Marcus Vance',
        authorRole: 'LOAN_OFFICER',
        type: 'INTERNAL_NOTE',
        content: 'Applicant met at Dar es Salaam Central branch. All registration certificates verified via BRELA portal.',
        createdAt: '2026-01-11T10:00:00.000Z',
      },
      {
        id: 'note-02',
        applicationId: 'app-2026-001',
        authorId: 'staff-off-01',
        authorName: 'Marcus Vance',
        authorRole: 'LOAN_OFFICER',
        type: 'RECOMMENDATION',
        content: 'Positive 2-year cash flows. Warehouse collateral valuation covers 240% of facility. Recommend full approval.',
        createdAt: '2026-01-14T14:30:00.000Z',
      },
    ],
    creditAssessment: {
      assessedByStaffId: 'staff-cred-01',
      assessedByName: 'Elena Rostova',
      assessedAt: '2026-01-15T11:00:00.000Z',
      creditScore: 745,
      monthlyIncome: 8500000,
      monthlyDebtObligations: 1200000,
      debtToIncomeRatio: 14.1,
      riskRating: 'LOW',
      maxRecommendedAmount: 60000000,
      assessmentSummary: 'Robust balance sheet with zero historical defaults. Excellent debt service coverage ratio.',
      decisionRecommendation: 'APPROVE',
    },
    recommendedByOfficerId: 'staff-off-01',
    recommendation: 'RECOMMEND_APPROVAL',
    recommendationNotes: 'Recommended full requested line of TZS 50,000,000',
    recommendedAt: '2026-01-14T14:30:00.000Z',
    approvedAmount: 50000000,
    approvedTermMonths: 24,
    approvedInterestRate: 8.75,
    approvedByStaffId: 'staff-cred-01',
    approvedByStaffName: 'Elena Rostova',
    approvalDate: '2026-01-15T15:00:00.000Z',
    approvalNotes: 'Approved under Commercial Risk Tier 1 mandate.',
    disbursedAmount: 50000000,
    disbursedAt: '2026-01-20T10:00:00.000Z',
    disbursementReference: 'DISB-TZS-2026-0042',
    loanId: 'loan-sme-0042',
    loanNumber: 'LN-2026-0042',
    applicationDate: '2026-01-10T09:00:00.000Z',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-20T10:00:00.000Z',
  },
  {
    id: 'app-2026-002',
    applicationNumber: 'APP-2026-0089',
    customerId: 'cust-01',
    customer: {
      id: 'cust-01',
      customerNumber: 'CUST-2026-0001',
      firstName: 'Alexander',
      lastName: 'Hayes',
      email: 'customer@nexa.financial',
      phone: '+255 712 345 678',
      idType: 'NATIONAL_ID',
      idNumber: 'TZ-1988-100234',
      employmentType: 'FULL_TIME_SALARIED',
      monthlyIncome: 8500000,
      creditScore: 745,
      profileStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
      branch: DEFAULT_BRANCH_DTO,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    loanProductId: 'prod-personal-01',
    loanProduct: {
      id: 'prod-personal-01',
      code: 'PROD_PERSONAL_PREMIER',
      name: 'Premier Salaried Credit Line',
      description: 'Fixed-rate amortized facility for verified high-income professionals.',
      minAmount: 1000000,
      maxAmount: 50000000,
      minTermMonths: 12,
      maxTermMonths: 60,
      baseInterestRate: 9.50,
      interestCalculationMethod: 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
      repaymentFrequency: 'MONTHLY',
      processingFeeValue: 500000,
      penaltyRate: 5.0,
      gracePeriodDays: 7,
      isActive: true,
    },
    branchId: 'br-dar-01',
    branchName: 'Dar es Salaam Central',
    requestedAmount: 15000000, // 15M TZS
    requestedTermMonths: 36,
    purpose: 'Residential solar and backup power generator procurement.',
    repaymentFrequency: 'MONTHLY',
    status: 'CREDIT_ASSESSMENT',
    loanOfficerId: 'staff-off-01',
    loanOfficerName: 'Marcus Vance',
    creditOfficerId: 'staff-cred-01',
    creditOfficerName: 'Elena Rostova',
    employmentInfo: {
      employerName: 'Vodacom Tanzania Plc',
      jobTitle: 'Senior Infrastructure Systems Architect',
      monthlyIncome: 5200000,
      employmentType: 'FULL_TIME_SALARIED',
    },
    bankDetails: {
      bankName: 'NMB Bank Plc',
      accountNumber: '20110048992',
      accountName: 'Alexander Hayes',
    },
    documents: [
      {
        id: 'doc-app-21',
        applicationId: 'app-2026-002',
        documentType: 'Salary Slips (3 Months)',
        documentName: 'Vodacom_Payslips_Q4.pdf',
        fileSize: '950 KB',
        fileUrl: '/uploads/payslips.pdf',
        uploadedAt: '2026-01-18T11:00:00.000Z',
        verified: true,
      },
    ],
    notes: [
      {
        id: 'note-21',
        applicationId: 'app-2026-002',
        authorId: 'staff-off-01',
        authorName: 'Marcus Vance',
        authorRole: 'LOAN_OFFICER',
        type: 'RECOMMENDATION',
        content: 'Verified employment contract and direct salary credit with NMB Bank. Recommend approval for TZS 15M.',
        createdAt: '2026-01-19T14:00:00.000Z',
      },
    ],
    recommendedByOfficerId: 'staff-off-01',
    recommendation: 'RECOMMEND_APPROVAL',
    recommendationNotes: 'Clean credit history. Salary direct debit agreement on file.',
    recommendedAt: '2026-01-19T14:00:00.000Z',
    applicationDate: '2026-01-18T10:30:00.000Z',
    createdAt: '2026-01-18T10:30:00.000Z',
    updatedAt: '2026-01-19T14:00:00.000Z',
  },
  {
    id: 'app-2026-003',
    applicationNumber: 'APP-2026-0105',
    customerId: 'cust-02',
    customer: {
      id: 'cust-02',
      customerNumber: 'CUST-2026-0002',
      firstName: 'Fatma',
      lastName: 'Mwinyi',
      email: 'fatma.mwinyi@kilimanjarofoods.co.tz',
      phone: '+255 784 990 011',
      idType: 'PASSPORT',
      idNumber: 'TZ-PASS-884210',
      employmentType: 'BUSINESS_OWNER',
      monthlyIncome: 12000000,
      creditScore: 710,
      profileStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
      branch: DEFAULT_BRANCH_DTO,
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z',
    },
    loanProductId: 'prod-agri-01',
    loanProduct: {
      id: 'prod-agri-01',
      code: 'PROD_AGRI_SEASONAL',
      name: 'Agricultural Seasonal Bullet Facility',
      description: 'Specialized seasonal crop cultivation credit line with quarterly servicing and bullet harvest repayment.',
      minAmount: 10000000,
      maxAmount: 200000000,
      minTermMonths: 3,
      maxTermMonths: 18,
      baseInterestRate: 8.25,
      interestCalculationMethod: 'FLAT_RATE',
      repaymentFrequency: 'QUARTERLY',
      processingFeeValue: 1.25,
      penaltyRate: 4.0,
      gracePeriodDays: 14,
      isActive: true,
    },
    branchId: 'br-dar-01',
    branchName: 'Dar es Salaam Central',
    requestedAmount: 40000000, // 40M TZS
    requestedTermMonths: 12,
    purpose: 'Organic spice and cashew processing equipment upgrade for export harvest.',
    repaymentFrequency: 'QUARTERLY',
    status: 'SUBMITTED',
    employmentInfo: {
      employerName: 'Kilimanjaro Agro Processing Ltd',
      jobTitle: 'Managing Partner',
      monthlyIncome: 12000000,
      employmentType: 'BUSINESS_OWNER',
    },
    bankDetails: {
      bankName: 'NBC Bank Tanzania',
      accountNumber: '04110009212',
      accountName: 'Kilimanjaro Agro Processing Ltd',
    },
    documents: [
      {
        id: 'doc-app-31',
        applicationId: 'app-2026-003',
        documentType: 'Export License',
        documentName: 'Tanzania_Cashew_Board_Export_License_2026.pdf',
        fileSize: '1.2 MB',
        fileUrl: '/uploads/cashew_license.pdf',
        uploadedAt: '2026-01-20T08:30:00.000Z',
        verified: false,
      },
    ],
    notes: [],
    applicationDate: '2026-01-20T08:30:00.000Z',
    createdAt: '2026-01-20T08:30:00.000Z',
    updatedAt: '2026-01-20T08:30:00.000Z',
  },
];

const activeMemoryApplications: LoanApplicationDTO[] = [...DEMO_APPLICATIONS];

// Helper to map Prisma entity to DTO
function mapPrismaApplicationToDTO(app: any): LoanApplicationDTO {
  return {
    id: app.id,
    applicationNumber: app.applicationNumber,
    customerId: app.customerId,
    customer: app.customer
      ? {
          id: app.customer.id,
          customerNumber: app.customer.customerNumber,
          firstName: app.customer.firstName,
          lastName: app.customer.lastName,
          email: app.customer.email,
          phone: app.customer.phone,
          idType: app.customer.idType || 'NATIONAL_ID',
          idNumber: app.customer.idNumber || 'TZ-ID-001',
          employmentType: app.customer.employmentType || 'FULL_TIME_SALARIED',
          monthlyIncome: Number(app.customer.monthlyIncome || 0),
          creditScore: app.customer.creditScore || 700,
          profileStatus: app.customer.profileStatus,
          kycStatus: app.customer.kycStatus,
          branch: app.customer.branch
            ? {
                id: app.customer.branch.id,
                branchCode: app.customer.branch.branchCode,
                name: app.customer.branch.name,
                city: app.customer.branch.city || 'Dar es Salaam',
                state: app.customer.branch.state || 'Dar es Salaam',
                country: app.customer.branch.country || 'Tanzania',
                status: app.customer.branch.status || 'ACTIVE',
              }
            : undefined,
          createdAt: app.customer.createdAt?.toISOString ? app.customer.createdAt.toISOString() : app.customer.createdAt,
          updatedAt: app.customer.updatedAt?.toISOString ? app.customer.updatedAt.toISOString() : app.customer.updatedAt,
        }
      : undefined,
    loanProductId: app.loanProductId,
    loanProduct: app.loanProduct
      ? {
          id: app.loanProduct.id,
          code: app.loanProduct.code,
          name: app.loanProduct.name,
          description: app.loanProduct.description,
          minAmount: Number(app.loanProduct.minAmount),
          maxAmount: Number(app.loanProduct.maxAmount),
          minTermMonths: app.loanProduct.minTermMonths,
          maxTermMonths: app.loanProduct.maxTermMonths,
          baseInterestRate: Number(app.loanProduct.defaultInterestRate) < 1
            ? Number(app.loanProduct.defaultInterestRate) * 100
            : Number(app.loanProduct.defaultInterestRate),
          interestCalculationMethod: app.loanProduct.interestCalculationMethod,
          repaymentFrequency: app.loanProduct.repaymentFrequency,
          processingFeeValue: Number(app.loanProduct.processingFeeValue),
          penaltyRate: Number(app.loanProduct.penaltyRate),
          gracePeriodDays: app.loanProduct.gracePeriodDays,
          isActive: app.loanProduct.status === 'ACTIVE',
        }
      : undefined,
    branchId: app.branchId,
    branchName: app.branch?.name,
    requestedAmount: Number(app.requestedAmount),
    requestedTermMonths: app.requestedTermMonths,
    purpose: app.purpose,
    repaymentFrequency: (app.loanProduct?.repaymentFrequency || 'MONTHLY') as any,
    status: app.status as LoanApplicationStatus,
    loanOfficerId: app.loanOfficerId,
    loanOfficerName: app.loanOfficer
      ? `${app.loanOfficer.firstName} ${app.loanOfficer.lastName}`
      : undefined,
    creditOfficerId: app.creditOfficerId,
    creditOfficerName: app.creditOfficer
      ? `${app.creditOfficer.firstName} ${app.creditOfficer.lastName}`
      : undefined,
    documents: (app.documents || []).map((d: any) => ({
      id: d.id,
      applicationId: app.id,
      documentType: d.documentType,
      documentName: d.fileName || d.documentNumber || 'Document',
      fileSize: d.fileSize || '1.0 MB',
      fileUrl: d.fileUrl,
      uploadedAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
      verified: d.verificationStatus === 'VERIFIED',
    })),
    notes: [],
    approvedAmount: app.approvedAmount ? Number(app.approvedAmount) : null,
    approvedTermMonths: app.approvedTermMonths,
    approvedInterestRate: app.approvedInterestRate ? Number(app.approvedInterestRate) : null,
    approvedByStaffId: app.approvedByStaffId,
    approvedByStaffName: app.approvedByStaff
      ? `${app.approvedByStaff.firstName} ${app.approvedByStaff.lastName}`
      : undefined,
    approvalDate: app.approvalDate ? app.approvalDate.toISOString() : null,
    approvalNotes: app.approvalNotes,
    rejectionReason: app.rejectionReason,
    rejectionDate: app.rejectionDate ? app.rejectionDate.toISOString() : null,
    loanId: app.loan?.id,
    loanNumber: app.loan?.loanNumber,
    applicationDate: app.applicationDate ? app.applicationDate.toISOString() : app.createdAt.toISOString(),
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  };
}

export async function getAllApplications(filters?: {
  customerId?: string;
  userId?: string;
  userRole?: UserRole;
  status?: string;
  search?: string;
}): Promise<LoanApplicationDTO[]> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const where: any = {};
      if (filters?.customerId) {
        where.customerId = filters.customerId;
      }
      if (filters?.userId && filters?.userRole === 'CUSTOMER') {
        const cust = await prisma.customer.findFirst({
          where: { OR: [{ userId: filters.userId }, { id: filters.userId }] },
        });
        if (cust) {
          where.customerId = cust.id;
        }
      }
      if (filters?.status && filters.status !== 'ALL') {
        where.status = filters.status;
      }

      const records = await prisma.loanApplication.findMany({
        where,
        include: {
          customer: { include: { branch: true } },
          loanProduct: true,
          branch: true,
          loanOfficer: true,
          creditOfficer: true,
          approvedByStaff: true,
          documents: true,
          loan: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (records.length > 0) {
        let results = records.map(mapPrismaApplicationToDTO);
        if (filters?.search) {
          const q = filters.search.toLowerCase().trim();
          results = results.filter(
            (a) =>
              a.applicationNumber.toLowerCase().includes(q) ||
              a.customer?.firstName.toLowerCase().includes(q) ||
              a.customer?.lastName.toLowerCase().includes(q) ||
              a.loanProduct?.name.toLowerCase().includes(q)
          );
        }
        return results;
      }
    } catch (err) {
      logger.error('Error fetching applications from MySQL:', err);
    }
  }

  // Memory fallback
  let list = [...activeMemoryApplications];

  if (filters?.customerId) {
    list = list.filter((a) => a.customerId === filters.customerId);
  } else if (filters?.userId && filters?.userRole === 'CUSTOMER') {
    list = list.filter(
      (a) =>
        a.customerId === filters.userId ||
        a.customerId === 'cust-01' ||
        a.customer?.id === filters.userId
    );
  }

  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((a) => a.status === filters.status);
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter(
      (a) =>
        a.applicationNumber.toLowerCase().includes(q) ||
        a.customer?.firstName.toLowerCase().includes(q) ||
        a.customer?.lastName.toLowerCase().includes(q) ||
        a.loanProduct?.name.toLowerCase().includes(q) ||
        a.purpose.toLowerCase().includes(q)
    );
  }

  return list;
}

export async function getApplicationById(id: string): Promise<LoanApplicationDTO> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      const record = await prisma.loanApplication.findUnique({
        where: { id },
        include: {
          customer: { include: { branch: true } },
          loanProduct: true,
          branch: true,
          loanOfficer: true,
          creditOfficer: true,
          approvedByStaff: true,
          documents: true,
          loan: true,
        },
      });
      if (record) return mapPrismaApplicationToDTO(record);
    } catch (err) {
      logger.error('Error fetching application by ID from MySQL:', err);
    }
  }

  const found = activeMemoryApplications.find((a) => a.id === id || a.applicationNumber === id);
  if (!found) throw AppError.notFound('Loan Application');
  return found;
}

export async function createApplication(
  userId: string,
  input: CreateLoanApplicationInput,
  userProfile?: { firstName: string; lastName: string; email: string }
): Promise<LoanApplicationDTO> {
  const products = await getAllLoanProducts(true);
  const product = products.find((p) => p.id === input.productId || p.code === input.productId);
  if (!product) {
    throw AppError.badRequest('Selected loan product does not exist or is inactive.');
  }

  if (input.principalAmount < product.minAmount) {
    throw AppError.badRequest(`Requested amount must be at least TZS ${product.minAmount.toLocaleString()}`);
  }
  if (input.principalAmount > product.maxAmount) {
    throw AppError.badRequest(`Requested amount cannot exceed TZS ${product.maxAmount.toLocaleString()}`);
  }
  if (input.termMonths < product.minTermMonths || input.termMonths > product.maxTermMonths) {
    throw AppError.badRequest(`Term must be between ${product.minTermMonths} and ${product.maxTermMonths} months.`);
  }

  const seq = Math.floor(1000 + Math.random() * 9000);
  const appNumber = `APP-2026-${seq}`;
  const initialStatus: LoanApplicationStatus = input.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED';

  const documents: ApplicationDocumentDTO[] = (input.documents || []).map((doc, idx) => ({
    id: `doc-${Date.now()}-${idx}`,
    applicationId: '',
    documentType: doc.documentType,
    documentName: doc.documentName,
    fileSize: doc.fileSize || '1.5 MB',
    fileUrl: doc.fileUrl,
    uploadedAt: new Date().toISOString(),
    verified: false,
  }));

  const initialNote: ApplicationNoteDTO[] = [];
  if (initialStatus === 'SUBMITTED') {
    initialNote.push({
      id: `note-${Date.now()}`,
      applicationId: '',
      authorId: userId,
      authorName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'Customer',
      authorRole: 'CUSTOMER',
      type: 'INTERNAL_NOTE',
      content: `Application officially submitted by applicant for underwriting review. Purpose: ${input.purpose}`,
      createdAt: new Date().toISOString(),
    });
  }

  const newAppId = `app-${Date.now()}`;
  documents.forEach((d) => (d.applicationId = newAppId));
  initialNote.forEach((n) => (n.applicationId = newAppId));

  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      let customer = await prisma.customer.findFirst({
        where: { OR: [{ userId }, { id: userId }] },
      });

      if (!customer) {
        let branch = await prisma.branch.findFirst({ where: { status: 'ACTIVE' } });
        customer = await prisma.customer.create({
          data: {
            customerNumber: `CUST-${seq}`,
            userId,
            branchId: branch?.id || '',
            firstName: userProfile?.firstName || 'Applicant',
            lastName: userProfile?.lastName || 'Client',
            email: userProfile?.email || `applicant-${seq}@nexa.financial`,
            phone: '+255 700 000 000',
            dateOfBirth: new Date('1992-05-15'),
            gender: 'PREFER_NOT_TO_SAY',
            idNumber: `NIDA-${seq}`,
            addressLine1: 'Dar es Salaam Central',
            city: 'Dar es Salaam',
            state: 'Dar es Salaam',
            monthlyIncome: input.employmentInfo?.monthlyIncome || 5000000,
          },
        });
      }

      // Find an available active loan officer to assign
      const loanOfficer = await prisma.staff.findFirst({
        where: { user: { role: { code: 'LOAN_OFFICER' } } },
      });

      const created = await prisma.loanApplication.create({
        data: {
          id: newAppId,
          applicationNumber: appNumber,
          customerId: customer.id,
          loanProductId: product.id,
          branchId: customer.branchId,
          requestedAmount: input.principalAmount,
          requestedTermMonths: input.termMonths,
          purpose: input.purpose,
          status: initialStatus as any,
          loanOfficerId: loanOfficer?.id,
          documents: {
            create: documents.map((d) => ({
              customerId: customer.id,
              documentType: d.documentType as any,
              documentName: d.documentName,
              fileUrl: d.fileUrl,
              fileSizeBytes: 102400,
              mimeType: 'application/pdf',
              verificationStatus: 'PENDING',
            })),
          },
        },
        include: {
          customer: { include: { branch: true } },
          loanProduct: true,
          branch: true,
          loanOfficer: true,
          documents: true,
        },
      });

      await recordAuditLog({
        userId,
        action: initialStatus === 'DRAFT' ? 'LOAN_APPLICATION_DRAFTED' : 'LOAN_APPLICATION_SUBMITTED',
        resource: 'LoanApplication',
        resourceId: created.id,
        details: { applicationNumber: appNumber, amountTZS: input.principalAmount, product: product.name },
      });

      return mapPrismaApplicationToDTO(created);
    } catch (err) {
      logger.error('Error creating loan application in MySQL:', err);
    }
  }

  // Memory fallback
  const newApp: LoanApplicationDTO = {
    id: newAppId,
    applicationNumber: appNumber,
    customerId: userId,
    customer: {
      id: userId,
      customerNumber: `CUST-2026-${seq}`,
      firstName: userProfile?.firstName || 'Borrower',
      lastName: userProfile?.lastName || 'Client',
      email: userProfile?.email || 'borrower@nexa.financial',
      phone: '+255 712 000 000',
      idType: 'NATIONAL_ID',
      idNumber: `NIDA-${seq}`,
      employmentType: 'FULL_TIME_SALARIED',
      monthlyIncome: input.employmentInfo?.monthlyIncome || 5000000,
      creditScore: 720,
      profileStatus: 'ACTIVE',
      kycStatus: 'VERIFIED',
      branch: DEFAULT_BRANCH_DTO,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    loanProductId: product.id,
    loanProduct: product,
    branchId: 'br-dar-01',
    branchName: 'Dar es Salaam Central',
    requestedAmount: input.principalAmount,
    requestedTermMonths: input.termMonths,
    purpose: input.purpose,
    repaymentFrequency: input.repaymentFrequency || 'MONTHLY',
    status: initialStatus,
    loanOfficerId: 'staff-off-01',
    loanOfficerName: 'Marcus Vance',
    employmentInfo: input.employmentInfo,
    bankDetails: input.bankDetails,
    guarantorInfo: input.guarantorInfo,
    collateralInfo: input.collateralInfo,
    documents,
    notes: initialNote,
    applicationDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  activeMemoryApplications.unshift(newApp);

  await recordAuditLog({
    userId,
    action: initialStatus === 'DRAFT' ? 'LOAN_APPLICATION_DRAFTED' : 'LOAN_APPLICATION_SUBMITTED',
    resource: 'LoanApplication',
    resourceId: newAppId,
    details: { applicationNumber: appNumber, amountTZS: input.principalAmount, product: product.name },
  });

  if (initialStatus === 'SUBMITTED') {
    dispatchNotification({
      eventType: 'LOAN_APPLICATION_SUBMITTED',
      recipientUserId: userId,
      recipientCustomerId: newApp.customerId,
      templateData: {
        applicationNumber: newApp.applicationNumber,
        customerName: newApp.customer ? `${newApp.customer.firstName} ${newApp.customer.lastName}` : 'Valued Client',
        customerFirstName: newApp.customer?.firstName || 'Client',
        amount: newApp.requestedAmount,
        productName: product.name,
        branchName: newApp.branchName || 'Dar es Salaam Central',
        phone: newApp.customer?.phone,
        email: newApp.customer?.email,
      },
    }).catch((err) => logger.warn('Failed to dispatch application submitted notification:', err));
  }

  return newApp;
}

export async function submitApplication(id: string, userId: string): Promise<LoanApplicationDTO> {
  const app = await getApplicationById(id);
  if (app.status !== 'DRAFT') {
    throw AppError.badRequest(`Only DRAFT applications can be submitted. Current status: ${app.status}`);
  }

  return transitionApplicationStatus(id, { userId, role: 'CUSTOMER', firstName: 'Customer', lastName: '' }, {
    targetStatus: 'SUBMITTED',
    notes: 'Application submitted by borrower for formal institutional credit evaluation.',
  });
}

export async function addApplicationDocument(
  id: string,
  userId: string,
  doc: { documentType: string; documentName: string; fileSize?: string; fileUrl: string }
): Promise<ApplicationDocumentDTO> {
  const app = await getApplicationById(id);
  const newDoc: ApplicationDocumentDTO = {
    id: `doc-${Date.now()}`,
    applicationId: id,
    documentType: doc.documentType,
    documentName: doc.documentName,
    fileSize: doc.fileSize || '1.5 MB',
    fileUrl: doc.fileUrl,
    uploadedAt: new Date().toISOString(),
    verified: false,
  };

  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      await prisma.customerDocument.create({
        data: {
          id: newDoc.id,
          customerId: app.customerId,
          loanApplicationId: id,
          documentType: doc.documentType as any,
          documentName: doc.documentName,
          fileUrl: doc.fileUrl,
          fileSizeBytes: 102400,
          mimeType: 'application/pdf',
          verificationStatus: 'PENDING',
        },
      });
    } catch (err) {
      logger.error('Error inserting document into MySQL:', err);
    }
  }

  // Memory fallback
  const memApp = activeMemoryApplications.find((a) => a.id === id);
  if (memApp) {
    memApp.documents.push(newDoc);
    memApp.updatedAt = new Date().toISOString();
  }

  await recordAuditLog({
    userId,
    action: 'APPLICATION_DOCUMENT_UPLOADED',
    resource: 'LoanApplication',
    resourceId: id,
    details: { documentType: doc.documentType, fileName: doc.documentName },
  });

  return newDoc;
}

export async function addApplicationNote(
  id: string,
  staffUser: { userId: string; role: string; firstName: string; lastName: string },
  note: AddApplicationNoteInput
): Promise<ApplicationNoteDTO> {
  await getApplicationById(id);

  const newNote: ApplicationNoteDTO = {
    id: `note-${Date.now()}`,
    applicationId: id,
    authorId: staffUser.userId,
    authorName: `${staffUser.firstName} ${staffUser.lastName}`.trim() || 'Staff Officer',
    authorRole: staffUser.role,
    type: note.type,
    content: note.content,
    createdAt: new Date().toISOString(),
  };

  const memApp = activeMemoryApplications.find((a) => a.id === id);
  if (memApp) {
    memApp.notes.push(newNote);
    memApp.updatedAt = new Date().toISOString();
  }

  await recordAuditLog({
    userId: staffUser.userId,
    action: note.type === 'INFO_REQUEST' ? 'ADDITIONAL_INFO_REQUESTED' : 'APPLICATION_NOTE_ADDED',
    resource: 'LoanApplication',
    resourceId: id,
    details: { noteType: note.type, preview: note.content.substring(0, 100) },
  });

  return newNote;
}

export async function recommendApplication(
  id: string,
  officer: { userId: string; role: string; firstName: string; lastName: string },
  input: RecommendApplicationInput
): Promise<LoanApplicationDTO> {
  const app = await getApplicationById(id);

  if (app.status !== 'UNDER_REVIEW' && app.status !== 'SUBMITTED') {
    throw AppError.badRequest(
      `Loan officer recommendations can only be submitted for applications currently UNDER_REVIEW or SUBMITTED. Current status: ${app.status}`
    );
  }

  const officerName = `${officer.firstName} ${officer.lastName}`.trim() || 'Loan Officer';

  // Add the recommendation note
  await addApplicationNote(id, officer, {
    type: 'RECOMMENDATION',
    content: `[${input.recommendation.replace('_', ' ')}]: ${input.notes}`,
  });

  const nextStatus: LoanApplicationStatus =
    input.recommendation === 'RECOMMEND_APPROVAL'
      ? 'CREDIT_ASSESSMENT'
      : input.recommendation === 'RECOMMEND_REJECTION'
      ? 'REJECTED'
      : 'UNDER_REVIEW';

  const memApp = activeMemoryApplications.find((a) => a.id === id);
  if (memApp) {
    memApp.recommendation = input.recommendation;
    memApp.recommendationNotes = input.notes;
    memApp.recommendedByOfficerId = officer.userId;
    memApp.recommendedAt = new Date().toISOString();
  }

  return transitionApplicationStatus(id, officer, {
    targetStatus: nextStatus,
    notes: `Officer ${officerName} submitted recommendation: ${input.recommendation}. Notes: ${input.notes}`,
    rejectionReason: input.recommendation === 'RECOMMEND_REJECTION' ? input.notes : undefined,
  });
}

export async function recordCreditAssessment(
  id: string,
  creditOfficer: { userId: string; role: string; firstName: string; lastName: string },
  assessment: CreditAssessmentInput
): Promise<CreditAssessmentDTO> {
  const app = await getApplicationById(id);

  if (app.status !== 'CREDIT_ASSESSMENT' && app.status !== 'UNDER_REVIEW') {
    throw AppError.badRequest(
      `Credit assessments can only be performed on applications in CREDIT_ASSESSMENT or UNDER_REVIEW stage. Current: ${app.status}`
    );
  }

  const officerName = `${creditOfficer.firstName} ${creditOfficer.lastName}`.trim() || 'Credit Officer';
  const assessmentDTO: CreditAssessmentDTO = {
    assessedByStaffId: creditOfficer.userId,
    assessedByName: officerName,
    assessedAt: new Date().toISOString(),
    creditScore: assessment.creditScore,
    monthlyIncome: assessment.monthlyIncome,
    monthlyDebtObligations: assessment.monthlyDebtObligations,
    debtToIncomeRatio: assessment.debtToIncomeRatio,
    riskRating: assessment.riskRating,
    maxRecommendedAmount: assessment.maxRecommendedAmount,
    assessmentSummary: assessment.assessmentSummary,
    decisionRecommendation: assessment.decisionRecommendation,
  };

  const memApp = activeMemoryApplications.find((a) => a.id === id);
  if (memApp) {
    memApp.creditAssessment = assessmentDTO;
    memApp.creditOfficerId = creditOfficer.userId;
    memApp.creditOfficerName = officerName;
    memApp.updatedAt = new Date().toISOString();
  }

  // Also log assessment as note
  await addApplicationNote(id, creditOfficer, {
    type: 'ASSESSMENT',
    content: `Credit Assessment Completed: Score ${assessment.creditScore}, DTI ${assessment.debtToIncomeRatio}%, Risk Rating ${assessment.riskRating}, Max Recommended: TZS ${assessment.maxRecommendedAmount.toLocaleString()}. Summary: ${assessment.assessmentSummary}`,
  });

  await recordAuditLog({
    userId: creditOfficer.userId,
    action: 'CREDIT_ASSESSMENT_RECORDED',
    resource: 'LoanApplication',
    resourceId: id,
    details: {
      creditScore: assessment.creditScore,
      riskRating: assessment.riskRating,
      dti: assessment.debtToIncomeRatio,
      recommended: assessment.decisionRecommendation,
    },
  });

  return assessmentDTO;
}

/**
 * Strict workflow state machine transition
 * Enforces:
 * Draft → Submitted → Under Review → Credit Assessment → Approved / Rejected → Disbursed → Active → Completed
 */
export async function transitionApplicationStatus(
  id: string,
  actor: { userId: string; role: string; firstName: string; lastName: string },
  input: TransitionApplicationStatusInput
): Promise<LoanApplicationDTO> {
  const app = await getApplicationById(id);
  const currentStatus = app.status;
  const targetStatus = input.targetStatus;

  // 1. Strict Transition Validation
  const allowedNext = ALLOWED_APPLICATION_TRANSITIONS[currentStatus] || [];
  if (!allowedNext.includes(targetStatus)) {
    throw AppError.badRequest(
      `Invalid workflow transition from "${currentStatus}" to "${targetStatus}". Allowed next transitions: [${allowedNext.join(', ')}]`
    );
  }

  // 2. Strict Role & Permission Authorization
  const actorRole = actor.role as UserRole;
  const isSuperAdmin = actorRole === 'SUPER_ADMIN';

  if (!isSuperAdmin) {
    if (targetStatus === 'APPROVED') {
      if (!['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'UNDERWRITER'].includes(actorRole)) {
        throw AppError.forbidden(
          `Unauthorized: Role "${actorRole}" does not have authority to approve credit facilities. Required: Credit Officer, Branch Manager, or Admin.`
        );
      }
    }

    if (targetStatus === 'REJECTED') {
      if (!['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'UNDERWRITER', 'LOAN_OFFICER'].includes(actorRole)) {
        throw AppError.forbidden(
          `Unauthorized: Role "${actorRole}" does not have authority to reject credit applications.`
        );
      }
    }

    if (targetStatus === 'DISBURSED') {
      if (!['ADMIN', 'BRANCH_MANAGER', 'CASHIER'].includes(actorRole)) {
        throw AppError.forbidden(
          `Unauthorized: Role "${actorRole}" does not have disbursement authority. Required: Cashier, Branch Manager, or Admin.`
        );
      }
    }
  }

  const now = new Date();
  const actorName = `${actor.firstName} ${actor.lastName}`.trim() || 'Staff Officer';

  // 3. Status-Specific Processing
  let approvedAmount = app.approvedAmount;
  let approvedTermMonths = app.approvedTermMonths;
  let approvedInterestRate = app.approvedInterestRate;
  let approvalDate = app.approvalDate;
  let approvalNotes = app.approvalNotes;
  let approvedByStaffId = app.approvedByStaffId;
  let approvedByStaffName = app.approvedByStaffName;

  let rejectionReason = app.rejectionReason;
  let rejectionDate = app.rejectionDate;
  let rejectedByStaffId = app.rejectedByStaffId;

  let disbursedAmount = app.disbursedAmount;
  let disbursedAt = app.disbursedAt;
  let disbursementReference = app.disbursementReference;
  let loanId = app.loanId;
  let loanNumber = app.loanNumber;

  if (targetStatus === 'APPROVED') {
    approvedAmount = input.approvedAmount || app.requestedAmount;
    approvedTermMonths = input.approvedTermMonths || app.requestedTermMonths;
    approvedInterestRate = input.approvedInterestRate || app.loanProduct?.baseInterestRate || 10.0;
    approvalDate = now.toISOString();
    approvalNotes = input.notes || 'Application formally approved by underwriting authority.';
    approvedByStaffId = actor.userId;
    approvedByStaffName = actorName;

    // Create approved loan record and repayment schedule
    // Important: status is PENDING_DISBURSEMENT (not active until disbursement)
    const approvedLoan = await createApprovedLoanRecord(
      app,
      approvedAmount,
      approvedTermMonths,
      approvedInterestRate,
      actor,
      approvalNotes
    );
    loanId = approvedLoan.id;
    loanNumber = approvedLoan.loanNumber;
  }

  if (targetStatus === 'REJECTED') {
    const reason = (input.rejectionReason || input.notes || '').trim();
    if (!reason) {
      throw AppError.badRequest('A reason or comment is strictly required when rejecting a loan application.');
    }
    rejectionReason = reason;
    rejectionDate = now.toISOString();
    rejectedByStaffId = actor.userId;
  }

  if (targetStatus === 'REVISION_REQUESTED') {
    const revNotes = (input.revisionNotes || input.notes || '').trim();
    if (!revNotes) {
      throw AppError.badRequest('Revision notes or comments are strictly required when requesting revision.');
    }
    await addApplicationNote(id, actor, {
      type: 'REVISION_REQUEST',
      content: `[REVISION REQUESTED]: ${revNotes}`,
    });
  }

  if (targetStatus === 'DISBURSED') {
    disbursedAmount = approvedAmount || app.approvedAmount || app.requestedAmount;
    disbursedAt = now.toISOString();
    disbursementReference = input.disbursementReference || `DISB-TZS-${Date.now()}`;
    const targetLoanId = app.loanId || loanId;

    if (targetLoanId) {
      const disbResult = await disburseLoanFacility(targetLoanId, actor, {
        disbursementReference,
        amount: disbursedAmount,
        disbursementDate: disbursedAt,
        paymentMethod: (input.disbursementMethod as any) || 'BANK_TRANSFER',
        transactionReference: (input as any).transactionReference || `TXN-DISB-${Date.now()}`,
        destinationAccount: input.destinationAccount,
        notes: input.notes,
      });
      loanNumber = disbResult.loan.loanNumber;
      loanId = disbResult.loan.id;
    }
  }

  // Database update if connected
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    try {
      await prisma.loanApplication.update({
        where: { id },
        data: {
          status: targetStatus as any,
          approvedAmount: approvedAmount ? approvedAmount : undefined,
          approvedTermMonths: approvedTermMonths || undefined,
          approvedInterestRate: approvedInterestRate ? approvedInterestRate / 100 : undefined,
          approvalDate: approvalDate ? new Date(approvalDate) : undefined,
          approvalNotes: approvalNotes || undefined,
          approvedByStaffId: approvedByStaffId || undefined,
          rejectionReason: rejectionReason || undefined,
          rejectionDate: rejectionDate ? new Date(rejectionDate) : undefined,
        },
      });
    } catch (err) {
      logger.error('Error updating loan application status in MySQL:', err);
    }
  }

  // Memory fallback update
  const memApp = activeMemoryApplications.find((a) => a.id === id);
  if (memApp) {
    memApp.status = targetStatus;
    memApp.approvedAmount = approvedAmount;
    memApp.approvedTermMonths = approvedTermMonths;
    memApp.approvedInterestRate = approvedInterestRate;
    memApp.approvalDate = approvalDate;
    memApp.approvalNotes = approvalNotes;
    memApp.approvedByStaffId = approvedByStaffId;
    memApp.approvedByStaffName = approvedByStaffName;

    memApp.rejectionReason = rejectionReason;
    memApp.rejectionDate = rejectionDate;
    memApp.rejectedByStaffId = rejectedByStaffId;

    memApp.disbursedAmount = disbursedAmount;
    memApp.disbursedAt = disbursedAt;
    memApp.disbursementReference = disbursementReference;
    memApp.loanId = loanId;
    memApp.loanNumber = loanNumber;
    memApp.updatedAt = now.toISOString();

    // Auto-advance DISBURSED to ACTIVE facility
    if (targetStatus === 'DISBURSED') {
      setTimeout(() => {
        memApp.status = 'ACTIVE';
      }, 500);
    }
  }

  // Add audit note to application notes trail
  await addApplicationNote(id, actor, {
    type: 'DECISION',
    content: `Status transitioned from ${currentStatus} to ${targetStatus} by ${actorName} (${actorRole}). Notes: ${input.notes || 'None provided'}`,
  });

  await recordAuditLog({
    userId: actor.userId,
    action: `APPLICATION_TRANSITION_${targetStatus}`,
    resource: 'LoanApplication',
    resourceId: id,
    details: {
      applicationNumber: app.applicationNumber,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reviewer: actorName,
      role: actorRole,
      notes: input.notes,
    },
  });

  // Automated Event Notification Dispatch
  if (targetStatus === 'APPROVED') {
    dispatchNotification({
      eventType: 'APPLICATION_APPROVED',
      recipientUserId: app.customerId,
      recipientCustomerId: app.customerId,
      templateData: {
        applicationNumber: app.applicationNumber,
        customerName: app.customer ? `${app.customer.firstName} ${app.customer.lastName}` : 'Valued Client',
        customerFirstName: app.customer?.firstName || 'Client',
        approvedAmount: approvedAmount || app.requestedAmount,
        interestRate: approvedInterestRate || 10,
        termMonths: approvedTermMonths || 12,
        monthlyInstallment: Math.round((approvedAmount || app.requestedAmount) / (approvedTermMonths || 12)),
        phone: app.customer?.phone,
        email: app.customer?.email,
      },
    }).catch((err) => logger.warn('Failed to dispatch approval notification:', err));
  } else if (targetStatus === 'REJECTED') {
    dispatchNotification({
      eventType: 'APPLICATION_REJECTED',
      recipientUserId: app.customerId,
      recipientCustomerId: app.customerId,
      templateData: {
        applicationNumber: app.applicationNumber,
        customerName: app.customer ? `${app.customer.firstName} ${app.customer.lastName}` : 'Valued Client',
        customerFirstName: app.customer?.firstName || 'Client',
        rejectionReason: rejectionReason || 'Criteria threshold not satisfied',
        phone: app.customer?.phone,
        email: app.customer?.email,
      },
    }).catch((err) => logger.warn('Failed to dispatch rejection notification:', err));
  } else if (targetStatus === 'REVISION_REQUESTED') {
    dispatchNotification({
      eventType: 'ADDITIONAL_INFO_REQUESTED',
      recipientUserId: app.customerId,
      recipientCustomerId: app.customerId,
      templateData: {
        applicationNumber: app.applicationNumber,
        customerName: app.customer ? `${app.customer.firstName} ${app.customer.lastName}` : 'Valued Client',
        customerFirstName: app.customer?.firstName || 'Client',
        infoRequestNotes: input.revisionNotes || input.notes || 'Please submit updated documentation',
        phone: app.customer?.phone,
        email: app.customer?.email,
      },
    }).catch((err) => logger.warn('Failed to dispatch additional info notification:', err));
  }

  return getApplicationById(id);
}

export async function getApplicationStats(): Promise<{
  totalApplications: number;
  submittedCount: number;
  underReviewCount: number;
  creditAssessmentCount: number;
  approvedCount: number;
  rejectedCount: number;
  disbursedCount: number;
  activeCount: number;
  totalRequestedVolumeTZS: number;
  totalDisbursedVolumeTZS: number;
}> {
  const apps = await getAllApplications();
  return {
    totalApplications: apps.length,
    submittedCount: apps.filter((a) => a.status === 'SUBMITTED').length,
    underReviewCount: apps.filter((a) => a.status === 'UNDER_REVIEW').length,
    creditAssessmentCount: apps.filter((a) => a.status === 'CREDIT_ASSESSMENT').length,
    approvedCount: apps.filter((a) => a.status === 'APPROVED').length,
    rejectedCount: apps.filter((a) => a.status === 'REJECTED').length,
    disbursedCount: apps.filter((a) => a.status === 'DISBURSED').length,
    activeCount: apps.filter((a) => a.status === 'ACTIVE').length,
    totalRequestedVolumeTZS: apps.reduce((sum, a) => sum + (a.requestedAmount || 0), 0),
    totalDisbursedVolumeTZS: apps.reduce((sum, a) => sum + (a.disbursedAmount || 0), 0),
  };
}

/**
 * Disburse approved loan application workflow.
 * Validates approval, registers disbursement transaction, and activates loan facility.
 */
export async function disburseApplication(
  id: string,
  actor: { userId: string; role: string; firstName: string; lastName: string },
  input: DisburseLoanInput
) {
  const app = await getApplicationById(id);
  if (app.status !== 'APPROVED') {
    throw AppError.badRequest(`Application must be in APPROVED status before disbursement. Current status: ${app.status}`);
  }

  if (!app.loanId) {
    throw AppError.badRequest('Approved loan record is missing for this application. Please re-approve to regenerate loan facility.');
  }

  const { loan, disbursement } = await disburseLoanFacility(app.loanId, actor, input);

  // Transition application to DISBURSED
  const updatedApp = await transitionApplicationStatus(id, actor, {
    targetStatus: 'DISBURSED',
    disbursementReference: disbursement.disbursementReference,
    disbursementMethod: disbursement.paymentMethod,
    approvedAmount: disbursement.amount,
    notes: input.notes || `Disbursed ${input.amount} TZS via ${input.paymentMethod}. Ref: ${disbursement.disbursementReference}`,
  });

  return { application: updatedApp, loan, disbursement };
}

/**
 * Get customer credit history and outstanding debt obligations for an application
 */
export async function getApplicationCustomerHistory(id: string) {
  const app = await getApplicationById(id);
  return getCustomerLoanSummary(app.customerId);
}
