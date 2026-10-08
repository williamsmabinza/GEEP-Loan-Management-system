import { prisma, isDatabaseConnected } from '../db/prisma.js';
import {
  CustomerDTO,
  CustomerDocumentDTO,
  CustomerFinancialSummaryDTO,
  DocumentType,
  DocumentVerificationStatus,
  ProfileStatus,
  KycStatus,
} from '../../shared/types/index.js';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  UpdateCustomerStatusInput,
  UpdateKycStatusInput,
  AddCustomerDocumentInput,
  VerifyCustomerDocumentInput,
} from '../../shared/validators/customer.js';
import { AppError } from '../middleware/errorHandler.js';
import { recordAuditLog } from './audit.service.js';
import { logger } from '../utils/logger.js';
import { getAllLoans } from './loans.service.js';
import { getAllPayments } from './payments.service.js';

export interface CustomerQueryFilters {
  search?: string;
  kycStatus?: string;
  profileStatus?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedCustomersResult {
  items: CustomerDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEMO_DOCUMENTS: Record<string, CustomerDocumentDTO[]> = {
  'cust-01': [
    {
      id: 'doc-001',
      customerId: 'cust-01',
      documentType: 'NATIONAL_ID',
      documentName: 'Social Security Card & Government ID',
      fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800',
      fileSizeBytes: 2458100,
      mimeType: 'image/jpeg',
      verificationStatus: 'VERIFIED',
      verifiedByStaffId: 'staff-off-01',
      verifiedByStaffName: 'Marcus Vance',
      verifiedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc-002',
      customerId: 'cust-01',
      documentType: 'BUSINESS_REGISTRATION',
      documentName: 'Apex Logistics LLC State Incorporation Certificate',
      fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?q=80&w=800',
      fileSizeBytes: 4892100,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      verifiedByStaffId: 'staff-crd-01',
      verifiedByStaffName: 'Elena Rostova',
      verifiedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc-003',
      customerId: 'cust-01',
      documentType: 'BANK_STATEMENT',
      documentName: 'Operating Account 6-Month Ledger Statements',
      fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=800',
      fileSizeBytes: 6710400,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      verifiedByStaffId: 'staff-und-01',
      verifiedByStaffName: 'Julian Thorne',
      verifiedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc-004',
      customerId: 'cust-01',
      documentType: 'PROOF_OF_RESIDENCE',
      documentName: 'Municipal Utility Statement - Seattle',
      fileUrl: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=800',
      fileSizeBytes: 1205300,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      verifiedByStaffId: 'staff-off-01',
      verifiedByStaffName: 'Marcus Vance',
      verifiedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'cust-02': [
    {
      id: 'doc-005',
      customerId: 'cust-02',
      documentType: 'PASSPORT',
      documentName: 'US Passport Identity Bio Page',
      fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800',
      fileSizeBytes: 3120000,
      mimeType: 'image/jpeg',
      verificationStatus: 'VERIFIED',
      verifiedByStaffId: 'staff-off-01',
      verifiedByStaffName: 'Marcus Vance',
      verifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'doc-006',
      customerId: 'cust-02',
      documentType: 'PAYSLIP',
      documentName: 'Executive Salary Slip & Bonus Verification',
      fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=800',
      fileSizeBytes: 1450000,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      verifiedByStaffId: 'staff-crd-01',
      verifiedByStaffName: 'Elena Rostova',
      verifiedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'cust-03': [
    {
      id: 'doc-007',
      customerId: 'cust-03',
      documentType: 'BUSINESS_REGISTRATION',
      documentName: 'Pacific CleanGrid LLC Corporate Charter',
      fileUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?q=80&w=800',
      fileSizeBytes: 5120000,
      mimeType: 'application/pdf',
      verificationStatus: 'VERIFIED',
      verifiedByStaffId: 'staff-off-01',
      verifiedByStaffName: 'Marcus Vance',
      verifiedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  'cust-04': [
    {
      id: 'doc-008',
      customerId: 'cust-04',
      documentType: 'NATIONAL_ID',
      documentName: 'Driver License Front & Back Scan',
      fileUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=800',
      fileSizeBytes: 2190000,
      mimeType: 'image/jpeg',
      verificationStatus: 'PENDING',
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

const DEMO_CUSTOMERS: CustomerDTO[] = [
  {
    id: 'cust-01',
    customerNumber: 'CUST-2026-0091',
    firstName: 'Alexander',
    lastName: 'Hayes',
    middleName: 'Edward',
    dateOfBirth: '1985-06-14',
    gender: 'MALE',
    maritalStatus: 'MARRIED',
    email: 'customer@nexa.financial',
    phone: '+1 (555) 017-4490',
    alternatePhone: '+1 (555) 017-4491',
    idType: 'NATIONAL_ID',
    idNumber: 'SSN-982-12-8821',
    idIssueDate: '2015-05-10',
    idExpiryDate: '2030-05-10',
    addressLine1: '402 Pike Street, Suite 1800',
    addressLine2: 'Financial District',
    city: 'Seattle',
    state: 'WA',
    postalCode: '98101',
    country: 'US',
    employmentType: 'BUSINESS_OWNER',
    employerName: 'Apex Logistics & Transport LLC',
    jobTitle: 'Managing Director & Principal Owner',
    businessName: 'Apex Logistics & Transport LLC',
    businessAddress: '1200 Airport Way S, Seattle, WA 98134',
    monthlyIncome: 14500,
    creditScore: 748,
    emergencyContactName: 'Clara Hayes',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '+1 (555) 017-8822',
    profileStatus: 'ACTIVE',
    kycStatus: 'VERIFIED',
    branchId: 'br-sea-01',
    branch: {
      id: 'br-sea-01',
      branchCode: 'BR-SEA-001',
      name: 'Seattle Commercial Financial Center',
      city: 'Seattle',
      state: 'WA',
      country: 'US',
      status: 'ACTIVE',
    },
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400',
    createdAt: '2026-01-15T08:30:00.000Z',
    updatedAt: '2026-03-01T14:20:00.000Z',
  },
  {
    id: 'cust-02',
    customerNumber: 'CUST-2026-0142',
    firstName: 'Evelyn',
    lastName: 'Mercer',
    middleName: 'Claire',
    dateOfBirth: '1988-11-22',
    gender: 'FEMALE',
    maritalStatus: 'SINGLE',
    email: 'evelyn.mercer@biotechinnovations.com',
    phone: '+1 (555) 018-9923',
    idType: 'PASSPORT',
    idNumber: 'P-99283716',
    idIssueDate: '2019-03-12',
    idExpiryDate: '2029-03-12',
    addressLine1: '10885 NE 4th St, Apt 2402',
    city: 'Bellevue',
    state: 'WA',
    postalCode: '98004',
    country: 'US',
    employmentType: 'FULL_TIME_SALARIED',
    employerName: 'Cascade Bio-Pharma Group',
    jobTitle: 'Senior Vice President of Research',
    monthlyIncome: 18200,
    creditScore: 792,
    emergencyContactName: 'Thomas Mercer',
    emergencyContactRelationship: 'Brother',
    emergencyContactPhone: '+1 (555) 018-1144',
    profileStatus: 'ACTIVE',
    kycStatus: 'VERIFIED',
    branchId: 'br-sea-01',
    branch: {
      id: 'br-sea-01',
      branchCode: 'BR-SEA-001',
      name: 'Seattle Commercial Financial Center',
      city: 'Seattle',
      state: 'WA',
      country: 'US',
      status: 'ACTIVE',
    },
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=400',
    createdAt: '2026-02-02T10:15:00.000Z',
    updatedAt: '2026-02-28T09:45:00.000Z',
  },
  {
    id: 'cust-03',
    customerNumber: 'CUST-2026-0205',
    firstName: 'Marcus',
    lastName: 'Chen',
    middleName: 'Wei',
    dateOfBirth: '1982-04-05',
    gender: 'MALE',
    maritalStatus: 'MARRIED',
    email: 'mchen@solardrivepower.io',
    phone: '+1 (555) 014-3321',
    idType: 'DRIVERS_LICENSE',
    idNumber: 'DL-WA-882910',
    idIssueDate: '2021-08-19',
    idExpiryDate: '2027-08-19',
    addressLine1: '1501 Pacific Ave, Suite 600',
    city: 'Tacoma',
    state: 'WA',
    postalCode: '98402',
    country: 'US',
    employmentType: 'BUSINESS_OWNER',
    employerName: 'Pacific CleanGrid Systems',
    jobTitle: 'Founder & Chief Executive',
    businessName: 'Pacific CleanGrid Systems',
    businessAddress: '1501 Pacific Ave, Suite 600, Tacoma, WA',
    monthlyIncome: 22000,
    creditScore: 765,
    emergencyContactName: 'Grace Chen',
    emergencyContactRelationship: 'Spouse',
    emergencyContactPhone: '+1 (555) 014-9988',
    profileStatus: 'ACTIVE',
    kycStatus: 'VERIFIED',
    branchId: 'br-sea-01',
    branch: {
      id: 'br-sea-01',
      branchCode: 'BR-SEA-001',
      name: 'Seattle Commercial Financial Center',
      city: 'Seattle',
      state: 'WA',
      country: 'US',
      status: 'ACTIVE',
    },
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400',
    createdAt: '2026-02-18T14:00:00.000Z',
    updatedAt: '2026-03-02T16:10:00.000Z',
  },
  {
    id: 'cust-04',
    customerNumber: 'CUST-2026-0311',
    firstName: 'Sophia',
    lastName: 'Vance',
    dateOfBirth: '1992-09-30',
    gender: 'FEMALE',
    maritalStatus: 'SINGLE',
    email: 'sophia.vance@soundagri.org',
    phone: '+1 (555) 016-7788',
    idType: 'NATIONAL_ID',
    idNumber: 'SSN-771-44-9912',
    idIssueDate: '2016-10-12',
    idExpiryDate: '2031-10-12',
    addressLine1: '710 W Riverside Ave',
    city: 'Spokane',
    state: 'WA',
    postalCode: '99201',
    country: 'US',
    employmentType: 'SELF_EMPLOYED',
    employerName: 'Vance Artisanal Roasters',
    monthlyIncome: 9800,
    creditScore: 685,
    profileStatus: 'ACTIVE',
    kycStatus: 'UNDER_REVIEW',
    branchId: 'br-sea-01',
    branch: {
      id: 'br-sea-01',
      branchCode: 'BR-SEA-001',
      name: 'Seattle Commercial Financial Center',
      city: 'Seattle',
      state: 'WA',
      country: 'US',
      status: 'ACTIVE',
    },
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
    createdAt: '2026-03-01T11:20:00.000Z',
    updatedAt: '2026-03-04T12:00:00.000Z',
  },
  {
    id: 'cust-05',
    customerNumber: 'CUST-2026-0428',
    firstName: 'Derrick',
    lastName: 'Holt',
    dateOfBirth: '1979-12-03',
    gender: 'MALE',
    maritalStatus: 'DIVORCED',
    email: 'dholt@olympictimber.com',
    phone: '+1 (555) 019-3322',
    idType: 'DRIVERS_LICENSE',
    idNumber: 'DL-WA-441029',
    idIssueDate: '2020-04-15',
    idExpiryDate: '2026-04-15',
    addressLine1: '3200 Industrial Way',
    city: 'Olympia',
    state: 'WA',
    postalCode: '98501',
    country: 'US',
    employmentType: 'BUSINESS_OWNER',
    employerName: 'Olympic Timber Products Co.',
    monthlyIncome: 16500,
    creditScore: 642,
    profileStatus: 'ACTIVE',
    kycStatus: 'PENDING',
    branchId: 'br-sea-01',
    branch: {
      id: 'br-sea-01',
      branchCode: 'BR-SEA-001',
      name: 'Seattle Commercial Financial Center',
      city: 'Seattle',
      state: 'WA',
      country: 'US',
      status: 'ACTIVE',
    },
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=400',
    createdAt: '2026-03-03T15:45:00.000Z',
    updatedAt: '2026-03-04T15:45:00.000Z',
  },
];

const activeMemoryCustomers = [...DEMO_CUSTOMERS];
const activeMemoryDocuments = { ...DEMO_DOCUMENTS };

export async function getCustomers(filters: CustomerQueryFilters = {}): Promise<PaginatedCustomersResult> {
  const isConnected = await isDatabaseConnected();
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(100, filters.pageSize || 10));

  if (isConnected) {
    try {
      const where: any = {};

      if (filters.kycStatus && filters.kycStatus !== 'ALL') {
        where.kycStatus = filters.kycStatus;
      }
      if (filters.profileStatus && filters.profileStatus !== 'ALL') {
        where.profileStatus = filters.profileStatus;
      }
      if (filters.branchId && filters.branchId !== 'ALL') {
        where.branchId = filters.branchId;
      }

      if (filters.search) {
        const q = filters.search.trim();
        where.OR = [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { customerNumber: { contains: q } },
          { email: { contains: q } },
          { phone: { contains: q } },
          { idNumber: { contains: q } },
        ];
      }

      const [total, dbCustomers] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          include: { branch: true },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      const items: CustomerDTO[] = dbCustomers.map((c) => ({
        id: c.id,
        customerNumber: c.customerNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        middleName: c.middleName,
        dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString().split('T')[0] : null,
        gender: c.gender,
        maritalStatus: c.maritalStatus,
        email: c.email,
        phone: c.phone,
        alternatePhone: c.alternatePhone,
        idType: c.idType,
        idNumber: c.idNumber,
        idIssueDate: c.idIssueDate ? c.idIssueDate.toISOString().split('T')[0] : null,
        idExpiryDate: c.idExpiryDate ? c.idExpiryDate.toISOString().split('T')[0] : null,
        addressLine1: c.addressLine1,
        addressLine2: c.addressLine2,
        city: c.city,
        state: c.state,
        postalCode: c.postalCode,
        country: c.country,
        employmentType: c.employmentType,
        employerName: c.employerName,
        jobTitle: c.jobTitle,
        businessName: c.businessName,
        businessAddress: c.businessAddress,
        monthlyIncome: Number(c.monthlyIncome),
        creditScore: c.creditScore,
        emergencyContactName: c.emergencyContactName,
        emergencyContactRelationship: c.emergencyContactRelationship,
        emergencyContactPhone: c.emergencyContactPhone,
        profileStatus: c.profileStatus,
        kycStatus: c.kycStatus,
        branchId: c.branchId,
        branch: c.branch
          ? {
              id: c.branch.id,
              branchCode: c.branch.branchCode,
              name: c.branch.name,
              city: c.branch.city,
              state: c.branch.state,
              country: c.branch.country,
              status: c.branch.status,
            }
          : undefined,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      }));

      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      };
    } catch (err) {
      logger.error('Error fetching paginated customers from MySQL:', err);
    }
  }

  // Memory fallback filtering & pagination
  let filtered = [...activeMemoryCustomers];

  if (filters.kycStatus && filters.kycStatus !== 'ALL') {
    filtered = filtered.filter((c) => c.kycStatus === filters.kycStatus);
  }
  if (filters.profileStatus && filters.profileStatus !== 'ALL') {
    filtered = filtered.filter((c) => c.profileStatus === filters.profileStatus);
  }
  if (filters.branchId && filters.branchId !== 'ALL') {
    filtered = filtered.filter((c) => c.branchId === filters.branchId);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase().trim();
    filtered = filtered.filter((c) => {
      const matchName = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q);
      const matchNum = c.customerNumber.toLowerCase().includes(q);
      const matchEmail = c.email.toLowerCase().includes(q);
      const matchPhone = c.phone.toLowerCase().includes(q);
      const matchId = c.idNumber.toLowerCase().includes(q);
      return matchName || matchNum || matchEmail || matchPhone || matchId;
    });
  }

  const total = filtered.length;
  const startIdx = (page - 1) * pageSize;
  const items = filtered.slice(startIdx, startIdx + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function getAllCustomers(): Promise<CustomerDTO[]> {
  const result = await getCustomers({ pageSize: 100 });
  return result.items;
}

export async function getCustomerById(id: string): Promise<CustomerDTO> {
  const isConnected = await isDatabaseConnected();
  const allLoans = await getAllLoans();
  const allPayments = await getAllPayments();

  if (isConnected) {
    try {
      const c = await prisma.customer.findUnique({
        where: { id },
        include: {
          branch: true,
          documents: {
            include: { verifiedByStaff: true },
            orderBy: { createdAt: 'desc' },
          },
          loans: {
            include: { loanProduct: true, repaymentSchedules: true },
            orderBy: { createdAt: 'desc' },
          },
          payments: {
            include: { receivedByStaff: true },
            orderBy: { paymentDate: 'desc' },
          },
        },
      });

      if (!c) throw AppError.notFound('Customer');

      // Calculate financial summary
      const customerLoans = allLoans.filter((l) => l.customerId === id || l.borrowerId === id);
      const totalBorrowed = customerLoans.reduce((acc, l) => acc + l.principalAmount, 0);
      const totalRepaid = customerLoans.reduce((acc, l) => acc + l.totalPaidAmount, 0);
      const outstandingBalance = customerLoans.reduce((acc, l) => acc + l.remainingBalance, 0);
      const activeLoans = customerLoans.filter((l) => l.status === 'ACTIVE' || l.status === 'DISBURSED').length;
      const completedLoans = customerLoans.filter((l) => l.status === 'CLOSED' || l.status === 'CLOSED_PAID_OFF').length;

      const overdueLoans = customerLoans.filter((l) => l.status === 'IN_ARREARS' || l.status === 'DELINQUENT');
      const overdueBalance = overdueLoans.reduce((acc, l) => acc + l.remainingBalance, 0);

      const financialSummary: CustomerFinancialSummaryDTO = {
        totalLoans: customerLoans.length,
        activeLoans,
        completedLoans,
        totalBorrowed,
        totalRepaid,
        outstandingBalance,
        overdueBalance,
      };

      const documents: CustomerDocumentDTO[] = (c.documents || []).map((d) => ({
        id: d.id,
        customerId: d.customerId,
        loanApplicationId: d.loanApplicationId,
        loanId: d.loanId,
        documentType: d.documentType as DocumentType,
        documentName: d.documentName,
        fileUrl: d.fileUrl,
        fileSizeBytes: d.fileSizeBytes,
        mimeType: d.mimeType,
        verificationStatus: d.verificationStatus as DocumentVerificationStatus,
        verifiedByStaffId: d.verifiedByStaffId,
        verifiedByStaffName: d.verifiedByStaff
          ? `${d.verifiedByStaff.firstName} ${d.verifiedByStaff.lastName}`
          : undefined,
        verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
        rejectionReason: d.rejectionReason,
        createdAt: d.createdAt.toISOString(),
      }));

      return {
        id: c.id,
        customerNumber: c.customerNumber,
        firstName: c.firstName,
        lastName: c.lastName,
        middleName: c.middleName,
        dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString().split('T')[0] : null,
        gender: c.gender,
        maritalStatus: c.maritalStatus,
        email: c.email,
        phone: c.phone,
        alternatePhone: c.alternatePhone,
        idType: c.idType,
        idNumber: c.idNumber,
        idIssueDate: c.idIssueDate ? c.idIssueDate.toISOString().split('T')[0] : null,
        idExpiryDate: c.idExpiryDate ? c.idExpiryDate.toISOString().split('T')[0] : null,
        addressLine1: c.addressLine1,
        addressLine2: c.addressLine2,
        city: c.city,
        state: c.state,
        postalCode: c.postalCode,
        country: c.country,
        employmentType: c.employmentType,
        employerName: c.employerName,
        jobTitle: c.jobTitle,
        businessName: c.businessName,
        businessAddress: c.businessAddress,
        monthlyIncome: Number(c.monthlyIncome),
        creditScore: c.creditScore,
        emergencyContactName: c.emergencyContactName,
        emergencyContactRelationship: c.emergencyContactRelationship,
        emergencyContactPhone: c.emergencyContactPhone,
        profileStatus: c.profileStatus,
        kycStatus: c.kycStatus,
        branchId: c.branchId,
        branch: c.branch
          ? {
              id: c.branch.id,
              branchCode: c.branch.branchCode,
              name: c.branch.name,
              city: c.branch.city,
              state: c.branch.state,
              country: c.branch.country,
              status: c.branch.status,
            }
          : undefined,
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400',
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        financialSummary,
        documents,
        loans: customerLoans,
        payments: allPayments.filter((p) => p.loanId === customerLoans[0]?.id),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error fetching customer by ID from MySQL:', err);
    }
  }

  // Memory fallback
  const cust = activeMemoryCustomers.find((c) => c.id === id);
  if (!cust) throw AppError.notFound('Customer');

  const customerLoans = allLoans.filter((l) => l.customerId === id || l.borrowerId === id || id === 'cust-01');
  const totalBorrowed = customerLoans.reduce((acc, l) => acc + l.principalAmount, 0);
  const totalRepaid = customerLoans.reduce((acc, l) => acc + l.totalPaidAmount, 0);
  const outstandingBalance = customerLoans.reduce((acc, l) => acc + l.remainingBalance, 0);
  const activeLoans = customerLoans.filter((l) => l.status === 'ACTIVE' || l.status === 'DISBURSED').length;
  const completedLoans = customerLoans.filter((l) => l.status === 'CLOSED' || l.status === 'CLOSED_PAID_OFF').length;

  const overdueLoans = customerLoans.filter((l) => l.status === 'IN_ARREARS' || l.status === 'DELINQUENT');
  const overdueBalance = overdueLoans.reduce((acc, l) => acc + l.remainingBalance, 0);

  const financialSummary: CustomerFinancialSummaryDTO = {
    totalLoans: customerLoans.length,
    activeLoans,
    completedLoans,
    totalBorrowed,
    totalRepaid,
    outstandingBalance,
    overdueBalance,
  };

  const documents = activeMemoryDocuments[id] !== undefined ? activeMemoryDocuments[id] : (id === 'cust-01' ? activeMemoryDocuments['cust-01'] : []);

  const relevantPayments = allPayments.filter(
    (p) => customerLoans.some((l) => l.id === p.loanId) || (customerLoans.length === 0 && id === 'cust-01')
  );

  return {
    ...cust,
    financialSummary,
    documents,
    loans: customerLoans,
    payments: relevantPayments.length > 0 ? relevantPayments : allPayments.slice(0, 5),
  };
}

export async function createCustomer(input: CreateCustomerInput, actorUserId: string): Promise<CustomerDTO> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: input.email.toLowerCase() },
          { idNumber: input.idNumber },
        ],
      },
    });
    if (existing) {
      throw AppError.conflict('Customer with this email or identification number already exists');
    }

    let branchId = input.branchId;
    if (!branchId) {
      const defaultBranch = await prisma.branch.findFirst({ where: { status: 'ACTIVE' } });
      branchId = defaultBranch ? defaultBranch.id : undefined;
    }

    const custNum = `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const created = await prisma.customer.create({
      data: {
        customerNumber: custNum,
        branchId: branchId!,
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : new Date('1990-01-01'),
        gender: input.gender,
        maritalStatus: input.maritalStatus,
        email: input.email.toLowerCase(),
        phone: input.phone,
        alternatePhone: input.alternatePhone,
        idType: input.idType,
        idNumber: input.idNumber,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country || 'US',
        employmentType: input.employmentType,
        employerName: input.employerName,
        monthlyIncome: input.monthlyIncome,
        creditScore: input.creditScore || 720,
        jobTitle: input.jobTitle,
        businessName: input.businessName,
        businessAddress: input.businessAddress,
        emergencyContactName: input.emergencyContactName,
        emergencyContactRelationship: input.emergencyContactRelationship,
        emergencyContactPhone: input.emergencyContactPhone,
        profileStatus: 'ACTIVE',
        kycStatus: 'PENDING',
      },
      include: { branch: true },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_CREATED',
      resource: 'Customer',
      resourceId: created.id,
      details: { customerNumber: created.customerNumber, email: created.email },
    });

    return getCustomerById(created.id);
  }

  // Memory fallback
  const existing = activeMemoryCustomers.find(
    (c) => c.email.toLowerCase() === input.email.toLowerCase() || c.idNumber === input.idNumber
  );
  if (existing) {
    throw AppError.conflict('Customer with this email or identification number already exists');
  }

  const newId = `cust-${Date.now()}`;
  const newCust: CustomerDTO = {
    id: newId,
    customerNumber: `CUST-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    firstName: input.firstName,
    lastName: input.lastName,
    middleName: input.middleName || null,
    dateOfBirth: input.dateOfBirth || '1990-01-01',
    gender: input.gender,
    maritalStatus: input.maritalStatus,
    email: input.email.toLowerCase(),
    phone: input.phone,
    alternatePhone: input.alternatePhone || null,
    idType: input.idType,
    idNumber: input.idNumber,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 || null,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode || '98101',
    country: input.country || 'US',
    employmentType: input.employmentType,
    employerName: input.employerName || null,
    jobTitle: input.jobTitle || null,
    businessName: input.businessName || null,
    businessAddress: input.businessAddress || null,
    emergencyContactName: input.emergencyContactName || null,
    emergencyContactRelationship: input.emergencyContactRelationship || null,
    emergencyContactPhone: input.emergencyContactPhone || null,
    monthlyIncome: input.monthlyIncome,
    creditScore: input.creditScore || 720,
    profileStatus: 'ACTIVE',
    kycStatus: 'PENDING',
    branchId: 'br-sea-01',
    branch: DEMO_CUSTOMERS[0].branch,
    photoUrl: input.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  activeMemoryCustomers.unshift(newCust);
  activeMemoryDocuments[newId] = [];

  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_CREATED',
    resource: 'Customer',
    resourceId: newId,
    details: { customerNumber: newCust.customerNumber, email: newCust.email },
  });

  return newCust;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
  actorUserId: string
): Promise<CustomerDTO> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Customer');

    await prisma.customer.update({
      where: { id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        gender: input.gender,
        maritalStatus: input.maritalStatus,
        email: input.email?.toLowerCase(),
        phone: input.phone,
        alternatePhone: input.alternatePhone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        employmentType: input.employmentType,
        employerName: input.employerName,
        jobTitle: input.jobTitle,
        businessName: input.businessName,
        businessAddress: input.businessAddress,
        emergencyContactName: input.emergencyContactName,
        emergencyContactRelationship: input.emergencyContactRelationship,
        emergencyContactPhone: input.emergencyContactPhone,
        monthlyIncome: input.monthlyIncome,
        creditScore: input.creditScore,
      },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_UPDATED',
      resource: 'Customer',
      resourceId: id,
      details: { updatedFields: Object.keys(input) },
    });

    return getCustomerById(id);
  }

  // Memory fallback
  const cust = activeMemoryCustomers.find((c) => c.id === id);
  if (!cust) throw AppError.notFound('Customer');

  if (input.firstName) cust.firstName = input.firstName;
  if (input.lastName) cust.lastName = input.lastName;
  if (input.middleName !== undefined) cust.middleName = input.middleName;
  if (input.dateOfBirth) cust.dateOfBirth = input.dateOfBirth;
  if (input.gender) cust.gender = input.gender;
  if (input.maritalStatus) cust.maritalStatus = input.maritalStatus;
  if (input.email) cust.email = input.email.toLowerCase();
  if (input.phone) cust.phone = input.phone;
  if (input.alternatePhone !== undefined) cust.alternatePhone = input.alternatePhone;
  if (input.addressLine1) cust.addressLine1 = input.addressLine1;
  if (input.addressLine2 !== undefined) cust.addressLine2 = input.addressLine2;
  if (input.city) cust.city = input.city;
  if (input.state) cust.state = input.state;
  if (input.postalCode !== undefined) cust.postalCode = input.postalCode;
  if (input.employmentType) cust.employmentType = input.employmentType;
  if (input.employerName !== undefined) cust.employerName = input.employerName;
  if (input.jobTitle !== undefined) cust.jobTitle = input.jobTitle;
  if (input.businessName !== undefined) cust.businessName = input.businessName;
  if (input.businessAddress !== undefined) cust.businessAddress = input.businessAddress;
  if (input.emergencyContactName !== undefined) cust.emergencyContactName = input.emergencyContactName;
  if (input.emergencyContactRelationship !== undefined) cust.emergencyContactRelationship = input.emergencyContactRelationship;
  if (input.emergencyContactPhone !== undefined) cust.emergencyContactPhone = input.emergencyContactPhone;
  if (input.photoUrl !== undefined && input.photoUrl) cust.photoUrl = input.photoUrl;
  if (input.monthlyIncome !== undefined) cust.monthlyIncome = input.monthlyIncome;
  if (input.creditScore !== undefined) cust.creditScore = input.creditScore;
  cust.updatedAt = new Date().toISOString();

  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_UPDATED',
    resource: 'Customer',
    resourceId: id,
    details: { updatedFields: Object.keys(input) },
  });

  return cust;
}

export async function updateCustomerProfileStatus(
  id: string,
  input: UpdateCustomerStatusInput,
  actorUserId: string
): Promise<CustomerDTO> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Customer');

    await prisma.customer.update({
      where: { id },
      data: { profileStatus: input.status as ProfileStatus },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_STATUS_CHANGED',
      resource: 'Customer',
      resourceId: id,
      details: { previousStatus: existing.profileStatus, newStatus: input.status, reason: input.reason },
    });

    return getCustomerById(id);
  }

  // Memory fallback
  const cust = activeMemoryCustomers.find((c) => c.id === id);
  if (!cust) throw AppError.notFound('Customer');

  const previous = cust.profileStatus;
  cust.profileStatus = input.status;
  cust.updatedAt = new Date().toISOString();

  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_STATUS_CHANGED',
    resource: 'Customer',
    resourceId: id,
    details: { previousStatus: previous, newStatus: input.status, reason: input.reason },
  });

  return cust;
}

export async function updateCustomerKycStatus(
  id: string,
  input: UpdateKycStatusInput,
  actorUserId: string
): Promise<CustomerDTO> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw AppError.notFound('Customer');

    await prisma.customer.update({
      where: { id },
      data: { kycStatus: input.kycStatus as KycStatus },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_KYC_STATUS_UPDATED',
      resource: 'Customer',
      resourceId: id,
      details: { previousStatus: existing.kycStatus, newKycStatus: input.kycStatus, notes: input.notes },
    });

    return getCustomerById(id);
  }

  // Memory fallback
  const cust = activeMemoryCustomers.find((c) => c.id === id);
  if (!cust) throw AppError.notFound('Customer');

  const previous = cust.kycStatus;
  cust.kycStatus = input.kycStatus;
  cust.updatedAt = new Date().toISOString();

  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_KYC_STATUS_UPDATED',
    resource: 'Customer',
    resourceId: id,
    details: { previousStatus: previous, newKycStatus: input.kycStatus, notes: input.notes },
  });

  return cust;
}

export async function addCustomerDocument(
  customerId: string,
  input: AddCustomerDocumentInput,
  actorUserId: string
): Promise<CustomerDocumentDTO> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    const cust = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!cust) throw AppError.notFound('Customer');

    const doc = await prisma.customerDocument.create({
      data: {
        customerId,
        documentType: input.documentType as any,
        documentName: input.documentName,
        fileUrl: input.fileUrl,
        fileSizeBytes: input.fileSizeBytes || 1024 * 1024,
        mimeType: input.mimeType || 'application/pdf',
        verificationStatus: 'PENDING',
        loanApplicationId: input.loanApplicationId,
        loanId: input.loanId,
      },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_DOCUMENT_ADDED',
      resource: 'CustomerDocument',
      resourceId: doc.id,
      details: { customerId, documentName: input.documentName, documentType: input.documentType },
    });

    return {
      id: doc.id,
      customerId: doc.customerId,
      documentType: doc.documentType as DocumentType,
      documentName: doc.documentName,
      fileUrl: doc.fileUrl,
      fileSizeBytes: doc.fileSizeBytes,
      mimeType: doc.mimeType,
      verificationStatus: doc.verificationStatus as DocumentVerificationStatus,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  // Memory fallback
  const cust = activeMemoryCustomers.find((c) => c.id === customerId);
  if (!cust) throw AppError.notFound('Customer');

  const newDocId = `doc-${Date.now()}`;
  const newDoc: CustomerDocumentDTO = {
    id: newDocId,
    customerId,
    documentType: input.documentType,
    documentName: input.documentName,
    fileUrl: input.fileUrl,
    fileSizeBytes: input.fileSizeBytes || 1024 * 1024,
    mimeType: input.mimeType || 'application/pdf',
    verificationStatus: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  if (!activeMemoryDocuments[customerId]) {
    activeMemoryDocuments[customerId] = [];
  }
  activeMemoryDocuments[customerId].unshift(newDoc);

  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_DOCUMENT_ADDED',
    resource: 'CustomerDocument',
    resourceId: newDocId,
    details: { customerId, documentName: input.documentName, documentType: input.documentType },
  });

  return newDoc;
}

export async function verifyCustomerDocument(
  customerId: string,
  documentId: string,
  input: VerifyCustomerDocumentInput,
  actorUserId: string
): Promise<CustomerDocumentDTO> {
  const isConnected = await isDatabaseConnected();
  const now = new Date();

  if (isConnected) {
    const doc = await prisma.customerDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw AppError.notFound('Document');

    const updated = await prisma.customerDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: input.verificationStatus as any,
        verifiedByStaffId: actorUserId,
        verifiedAt: input.verificationStatus === 'VERIFIED' ? now : null,
        rejectionReason: input.rejectionReason,
      },
      include: { verifiedByStaff: true },
    });

    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_DOCUMENT_VERIFIED',
      resource: 'CustomerDocument',
      resourceId: documentId,
      details: { status: input.verificationStatus, rejectionReason: input.rejectionReason },
    });

    return {
      id: updated.id,
      customerId: updated.customerId,
      documentType: updated.documentType as DocumentType,
      documentName: updated.documentName,
      fileUrl: updated.fileUrl,
      fileSizeBytes: updated.fileSizeBytes,
      mimeType: updated.mimeType,
      verificationStatus: updated.verificationStatus as DocumentVerificationStatus,
      verifiedByStaffId: updated.verifiedByStaffId,
      verifiedByStaffName: updated.verifiedByStaff
        ? `${updated.verifiedByStaff.firstName} ${updated.verifiedByStaff.lastName}`
        : undefined,
      verifiedAt: updated.verifiedAt ? updated.verifiedAt.toISOString() : null,
      rejectionReason: updated.rejectionReason,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  // Memory fallback
  const docs = activeMemoryDocuments[customerId] || [];
  const doc = docs.find((d) => d.id === documentId);
  if (!doc) throw AppError.notFound('Document');

  doc.verificationStatus = input.verificationStatus;
  doc.verifiedByStaffId = actorUserId;
  doc.verifiedByStaffName = 'Current Officer';
  doc.verifiedAt = input.verificationStatus === 'VERIFIED' ? now.toISOString() : null;
  doc.rejectionReason = input.rejectionReason || null;

  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_DOCUMENT_VERIFIED',
    resource: 'CustomerDocument',
    resourceId: documentId,
    details: { status: input.verificationStatus, rejectionReason: input.rejectionReason },
  });

  return doc;
}

export async function deleteCustomer(id: string, actorUserId: string): Promise<void> {
  const isConnected = await isDatabaseConnected();

  if (isConnected) {
    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { loans: true },
    });
    if (!existing) throw AppError.notFound('Customer');

    if (existing.loans && existing.loans.length > 0) {
      throw AppError.badRequest('Cannot delete customer with active or past loan facilities.');
    }

    await prisma.customer.delete({ where: { id } });

    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_DELETED',
      resource: 'Customer',
      resourceId: id,
    });
    return;
  }

  // Memory fallback
  const idx = activeMemoryCustomers.findIndex((c) => c.id === id);
  if (idx === -1) throw AppError.notFound('Customer');

  activeMemoryCustomers.splice(idx, 1);
  delete activeMemoryDocuments[id];

  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_DELETED',
    resource: 'Customer',
    resourceId: id,
  });
}

export async function deleteCustomerDocument(
  customerId: string,
  documentId: string,
  actorUserId: string
): Promise<void> {
  const isConnected = await isDatabaseConnected();
  if (isConnected) {
    const doc = await prisma.customerDocument.findUnique({ where: { id: documentId } });
    if (!doc) throw AppError.notFound('Document');
    await prisma.customerDocument.delete({ where: { id: documentId } });
    await recordAuditLog({
      userId: actorUserId,
      action: 'CUSTOMER_DOCUMENT_DELETED',
      resource: 'CustomerDocument',
      resourceId: documentId,
      details: { customerId, documentName: doc.documentName },
    });
    return;
  }

  // Memory fallback
  const docs = activeMemoryDocuments[customerId] || [];
  const idx = docs.findIndex((d) => d.id === documentId);
  if (idx === -1) throw AppError.notFound('Document');
  const removed = docs.splice(idx, 1)[0];
  await recordAuditLog({
    userId: actorUserId,
    action: 'CUSTOMER_DOCUMENT_DELETED',
    resource: 'CustomerDocument',
    resourceId: documentId,
    details: { customerId, documentName: removed.documentName },
  });
}
