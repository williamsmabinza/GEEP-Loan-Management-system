import {
  PrismaClient,
  UserStatus,
  KycStatus,
  ProfileStatus,
  Gender,
  MaritalStatus,
  IdentificationType,
  EmploymentType,
  BranchStatus,
  StaffEmploymentStatus,
  InterestCalculationMethod,
  RepaymentFrequency,
  FeeType,
  ProductStatus,
  LoanApplicationStatus,
  LoanStatus,
  PaymentMethod,
  DisbursementStatus,
  RepaymentScheduleStatus,
  PaymentAllocationStatus,
  PenaltyStatus,
  PenaltyType,
  CollateralType,
  CollateralStatus,
  GuarantorStatus,
  DocumentType,
  DocumentVerificationStatus,
  NotificationChannel,
  NotificationStatus,
  SystemSettingGroup,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function main() {
  console.log('🌱 Starting comprehensive Nexa LMS enterprise database seed...');

  // 1. Clean existing records in reverse dependency order
  try {
    await prisma.paymentAllocation.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.penalty.deleteMany();
    await prisma.repaymentSchedule.deleteMany();
    await prisma.loanDisbursement.deleteMany();
    await prisma.collateral.deleteMany();
    await prisma.loanGuarantor.deleteMany();
    await prisma.customerDocument.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.loan.deleteMany();
    await prisma.loanApplication.deleteMany();
    await prisma.interestRate.deleteMany();
    await prisma.loanProduct.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.systemSetting.deleteMany();
    await prisma.rolePermission.deleteMany();
    await prisma.permission.deleteMany();
    await prisma.user.deleteMany();
    await prisma.role.deleteMany();
    await prisma.branch.deleteMany();
    console.log('✓ Wiped existing records in reverse dependency order');
  } catch (err) {
    console.warn('⚠️ Notice during initial table wipe (expected if clean):', (err as Error).message);
  }

  // 2. Seed Roles
  const rolesData = [
    { name: 'Super Administrator', code: 'SUPER_ADMIN', description: 'Unrestricted system infrastructure access', isSystem: true },
    { name: 'Administrator', code: 'ADMIN', description: 'System-wide risk, operations, and compliance management', isSystem: true },
    { name: 'Branch Manager', code: 'BRANCH_MANAGER', description: 'Branch-level operational oversight and approvals', isSystem: true },
    { name: 'Loan Officer', code: 'LOAN_OFFICER', description: 'Loan origination, borrower vetting, and servicing', isSystem: true },
    { name: 'Credit Officer', code: 'CREDIT_OFFICER', description: 'Credit appraisal, financial analysis, and committee reviews', isSystem: true },
    { name: 'Cashier', code: 'CASHIER', description: 'Cash and payment collection teller operations', isSystem: true },
    { name: 'Accountant', code: 'ACCOUNTANT', description: 'Financial reconciliation, ledger balancing, and accounting', isSystem: true },
    { name: 'Collection Officer', code: 'COLLECTION_OFFICER', description: 'Delinquent recovery, arrears tracking, and collections', isSystem: true },
    { name: 'Customer', code: 'CUSTOMER', description: 'Retail and commercial borrower portal account', isSystem: true },
  ];

  const rolesMap = new Map<string, string>();
  for (const r of rolesData) {
    const role = await prisma.role.create({ data: r });
    rolesMap.set(r.code, role.id);
  }
  console.log(`✓ Seeded ${rolesData.length} institutional roles`);

  // 3. Seed Granular Permissions
  const permissionsData = [
    { code: 'loan:view_all', name: 'View All Loans', module: 'LOANS' },
    { code: 'loan:create', name: 'Originate Loan', module: 'LOANS' },
    { code: 'loan:appraise', name: 'Appraise Credit Application', module: 'LOANS' },
    { code: 'loan:approve', name: 'Approve Loan Application', module: 'LOANS' },
    { code: 'loan:disburse', name: 'Disburse Loan Capital', module: 'LOANS' },
    { code: 'repayment:view', name: 'View Repayment Schedules', module: 'REPAYMENTS' },
    { code: 'repayment:collect', name: 'Collect & Record Payment', module: 'REPAYMENTS' },
    { code: 'penalty:assess', name: 'Assess Delinquency Penalty', module: 'PENALTIES' },
    { code: 'penalty:waive', name: 'Waive Accrued Penalty', module: 'PENALTIES' },
    { code: 'customer:create', name: 'Register Customer', module: 'CUSTOMERS' },
    { code: 'customer:view', name: 'View Customer Dossier', module: 'CUSTOMERS' },
    { code: 'customer:kyc_verify', name: 'Verify KYC Documentation', module: 'CUSTOMERS' },
    { code: 'audit:view', name: 'Inspect Compliance Audit Trail', module: 'COMPLIANCE' },
    { code: 'settings:manage', name: 'Manage System Settings', module: 'SETTINGS' },
  ];

  const permIds: string[] = [];
  for (const p of permissionsData) {
    const perm = await prisma.permission.create({ data: p });
    permIds.push(perm.id);
  }

  // Grant all permissions to Super Admin and Admin
  const adminRoleId = rolesMap.get('ADMIN')!;
  const superAdminRoleId = rolesMap.get('SUPER_ADMIN')!;
  const officerRoleId = rolesMap.get('LOAN_OFFICER')!;
  const creditOfficerRoleId = rolesMap.get('CREDIT_OFFICER')!;

  for (const pId of permIds) {
    await prisma.rolePermission.create({ data: { roleId: superAdminRoleId, permissionId: pId } });
    await prisma.rolePermission.create({ data: { roleId: adminRoleId, permissionId: pId } });
  }

  // Grant specific permissions to Loan Officer
  const officerPermCodes = ['loan:view_all', 'loan:create', 'repayment:view', 'repayment:collect', 'customer:create', 'customer:view'];
  for (const p of permissionsData.filter((x) => officerPermCodes.includes(x.code))) {
    const pRecord = await prisma.permission.findUnique({ where: { code: p.code } });
    if (pRecord) {
      await prisma.rolePermission.create({ data: { roleId: officerRoleId, permissionId: pRecord.id } });
    }
  }
  console.log(`✓ Seeded ${permissionsData.length} granular permissions and mapped Role-Based matrix`);

  // 4. Seed Branches
  const hqBranch = await prisma.branch.create({
    data: {
      branchCode: 'BR-HQ-001',
      name: 'Nexa Financial Capital District',
      phone: '+1 (555) 100-2000',
      email: 'capital.branch@nexa.financial',
      addressLine1: '100 Wall Street, Floor 32',
      city: 'New York',
      state: 'NY',
      postalCode: '10005',
      country: 'US',
      status: BranchStatus.ACTIVE,
    },
  });

  const pacificBranch = await prisma.branch.create({
    data: {
      branchCode: 'BR-PAC-002',
      name: 'Pacific Commercial Banking Hub',
      phone: '+1 (555) 200-3000',
      email: 'pacific.branch@nexa.financial',
      addressLine1: '500 Pine Street, Suite 1200',
      city: 'Seattle',
      state: 'WA',
      postalCode: '98101',
      country: 'US',
      status: BranchStatus.ACTIVE,
    },
  });
  console.log(`✓ Seeded 2 financial operating branches`);

  // 5. Seed Passwords & Staff Users
  const salt = await bcrypt.genSalt(10);
  const defaultAdminPass = await bcrypt.hash('Admin@2026!', salt);
  const defaultStaffPass = await bcrypt.hash('Officer@2026!', salt);
  const defaultCustPass = await bcrypt.hash('Customer@2026!', salt);

  // Admin User & Staff
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@nexa.financial',
      passwordHash: defaultAdminPass,
      roleId: adminRoleId,
      status: UserStatus.ACTIVE,
      staffProfile: {
        create: {
          branchId: hqBranch.id,
          staffNumber: 'STF-ADM-001',
          firstName: 'Sarah',
          lastName: 'Sterling',
          phone: '+1 (555) 019-2831',
          department: 'Executive Risk & Compliance',
          designation: 'Chief Risk Officer',
          employmentStatus: StaffEmploymentStatus.ACTIVE,
          dateOfHire: new Date('2022-01-10'),
        },
      },
    },
    include: { staffProfile: true },
  });

  // Loan Officer User & Staff
  const officerUser = await prisma.user.create({
    data: {
      email: 'officer@nexa.financial',
      passwordHash: defaultStaffPass,
      roleId: officerRoleId,
      status: UserStatus.ACTIVE,
      staffProfile: {
        create: {
          branchId: pacificBranch.id,
          staffNumber: 'STF-OFF-042',
          firstName: 'Marcus',
          lastName: 'Vance',
          phone: '+1 (555) 014-9823',
          department: 'Commercial Credit Origination',
          designation: 'Senior Loan Officer',
          employmentStatus: StaffEmploymentStatus.ACTIVE,
          dateOfHire: new Date('2023-04-15'),
        },
      },
    },
    include: { staffProfile: true },
  });

  // Credit Officer User & Staff
  const creditOfficerUser = await prisma.user.create({
    data: {
      email: 'underwriter@nexa.financial',
      passwordHash: defaultStaffPass,
      roleId: creditOfficerRoleId,
      status: UserStatus.ACTIVE,
      staffProfile: {
        create: {
          branchId: hqBranch.id,
          staffNumber: 'STF-UND-019',
          firstName: 'David',
          lastName: 'Chen',
          phone: '+1 (555) 018-7721',
          department: 'Credit Risk Appraisal',
          designation: 'Senior Credit Underwriter',
          employmentStatus: StaffEmploymentStatus.ACTIVE,
          dateOfHire: new Date('2022-08-01'),
        },
      },
    },
    include: { staffProfile: true },
  });
  console.log(`✓ Seeded administrative and credit staff users`);

  // 6. Seed Customer User & Customer Profile
  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@nexa.financial',
      passwordHash: defaultCustPass,
      roleId: rolesMap.get('CUSTOMER')!,
      status: UserStatus.ACTIVE,
      customer: {
        create: {
          customerNumber: 'CUST-2026-0091',
          branchId: pacificBranch.id,
          firstName: 'Alexander',
          lastName: 'Hayes',
          middleName: 'Thomas',
          dateOfBirth: new Date('1984-06-18'),
          gender: Gender.MALE,
          maritalStatus: MaritalStatus.MARRIED,
          email: 'customer@nexa.financial',
          phone: '+1 (555) 017-4490',
          idType: IdentificationType.NATIONAL_ID,
          idNumber: 'SSN-982-12-8821',
          idIssueDate: new Date('2018-05-10'),
          idExpiryDate: new Date('2028-05-10'),
          addressLine1: '742 Evergreen Terrace, Suite 400',
          city: 'Seattle',
          state: 'WA',
          postalCode: '98101',
          country: 'US',
          employmentType: EmploymentType.BUSINESS_OWNER,
          employerName: 'Apex Logistics & Transport LLC',
          jobTitle: 'Managing Principal',
          monthlyIncome: 14500.00,
          businessName: 'Apex Logistics & Transport LLC',
          businessAddress: '1200 Industrial Parkway, Seattle, WA 98134',
          emergencyContactName: 'Claire Hayes',
          emergencyContactRelationship: 'Spouse',
          emergencyContactPhone: '+1 (555) 017-4492',
          profileStatus: ProfileStatus.ACTIVE,
          kycStatus: KycStatus.VERIFIED,
          creditScore: 748,
        },
      },
    },
    include: { customer: true },
  });

  const customerRecord = customerUser.customer!;
  console.log(`✓ Seeded customer ${customerRecord.customerNumber} (${customerRecord.firstName} ${customerRecord.lastName})`);

  // 7. Seed Loan Products & Interest Rates
  const smeProduct = await prisma.loanProduct.create({
    data: {
      code: 'PROD_SME_WORKING_CAPITAL',
      name: 'Commercial Working Capital Facility',
      description: 'Revolving liquidity and capital expansion facility for registered enterprise corporations.',
      minAmount: 25000.00,
      maxAmount: 500000.00,
      minTermMonths: 6,
      maxTermMonths: 36,
      defaultInterestRate: 0.0875, // 8.75%
      interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE_EQUAL_INSTALLMENTS,
      repaymentFrequency: RepaymentFrequency.MONTHLY,
      processingFeeType: FeeType.PERCENTAGE_OF_PRINCIPAL,
      processingFeeValue: 0.0150, // 1.5%
      insuranceFeeType: FeeType.PERCENTAGE_OF_PRINCIPAL,
      insuranceFeeValue: 0.0050, // 0.5%
      penaltyRate: 0.0500, // 5% monthly penalty on overdue balance
      gracePeriodDays: 5,
      principalGracePeriodMonths: 0,
      status: ProductStatus.ACTIVE,
      interestRateTiers: {
        create: [
          {
            tierName: 'Prime Enterprise (Tier 1)',
            minAmount: 100000.00,
            maxAmount: 500000.00,
            minTermMonths: 12,
            maxTermMonths: 36,
            rate: 0.0795,
            effectiveFrom: new Date('2026-01-01'),
            isActive: true,
          },
          {
            tierName: 'Standard Commercial (Tier 2)',
            minAmount: 25000.00,
            maxAmount: 99999.99,
            minTermMonths: 6,
            maxTermMonths: 24,
            rate: 0.0875,
            effectiveFrom: new Date('2026-01-01'),
            isActive: true,
          },
        ],
      },
    },
  });

  const personalProduct = await prisma.loanProduct.create({
    data: {
      code: 'PROD_PERSONAL_PREMIER',
      name: 'Premier Salaried Credit Line',
      description: 'Fixed-term amortized facility for verified high-income professionals.',
      minAmount: 5000.00,
      maxAmount: 75000.00,
      minTermMonths: 12,
      maxTermMonths: 60,
      defaultInterestRate: 0.0950, // 9.50%
      interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE_EQUAL_INSTALLMENTS,
      repaymentFrequency: RepaymentFrequency.MONTHLY,
      processingFeeType: FeeType.FIXED_AMOUNT,
      processingFeeValue: 250.00,
      insuranceFeeType: FeeType.PERCENTAGE_OF_PRINCIPAL,
      insuranceFeeValue: 0.0075,
      penaltyRate: 0.0500,
      gracePeriodDays: 7,
      status: ProductStatus.ACTIVE,
    },
  });

  const equipmentProduct = await prisma.loanProduct.create({
    data: {
      code: 'PROD_COMMERCIAL_EQUIPMENT',
      name: 'Heavy Equipment & Fleet Asset Financing',
      description: 'Asset-backed capital procurement facility for industrial transport, machinery, and fleet vehicles.',
      minAmount: 50000.00,
      maxAmount: 1500000.00,
      minTermMonths: 24,
      maxTermMonths: 84,
      defaultInterestRate: 0.0695, // 6.95%
      interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE_EQUAL_INSTALLMENTS,
      repaymentFrequency: RepaymentFrequency.MONTHLY,
      processingFeeType: FeeType.PERCENTAGE_OF_PRINCIPAL,
      processingFeeValue: 0.0100,
      penaltyRate: 0.0300,
      gracePeriodDays: 10,
      status: ProductStatus.ACTIVE,
    },
  });
  console.log(`✓ Seeded 3 configurable loan products and interest rate tiers`);

  // 8. Seed Loan Applications
  const application1 = await prisma.loanApplication.create({
    data: {
      applicationNumber: 'APP-2026-0042',
      customerId: customerRecord.id,
      loanProductId: smeProduct.id,
      branchId: pacificBranch.id,
      requestedAmount: 100000.00,
      requestedTermMonths: 24,
      purpose: 'Warehouse automation and inventory expansion for logistics fulfillment center.',
      applicationDate: new Date('2026-01-10T10:00:00Z'),
      status: LoanApplicationStatus.APPROVED,
      loanOfficerId: officerUser.staffProfile!.id,
      creditOfficerId: creditOfficerUser.staffProfile!.id,
      approvedByStaffId: adminUser.staffProfile!.id,
      approvedAmount: 100000.00,
      approvedTermMonths: 24,
      approvedInterestRate: 0.0875,
      approvalDate: new Date('2026-01-15T14:30:00Z'),
      approvalNotes: 'Audited financial statements show strong DSCR of 1.85. Inventory valuation verified.',
    },
  });

  const application2 = await prisma.loanApplication.create({
    data: {
      applicationNumber: 'APP-2026-0089',
      customerId: customerRecord.id,
      loanProductId: personalProduct.id,
      branchId: pacificBranch.id,
      requestedAmount: 35000.00,
      requestedTermMonths: 36,
      purpose: 'Executive commercial certification and business leadership training program.',
      applicationDate: new Date('2026-09-28T11:20:00Z'),
      status: LoanApplicationStatus.UNDER_REVIEW,
      loanOfficerId: officerUser.staffProfile!.id,
    },
  });
  console.log(`✓ Seeded loan applications (Approved & Under Review)`);

  // 9. Seed Active Loan for Application 1
  const principalAmount = 100000.00;
  const annualRate = 0.0875;
  const termMonths = 24;
  const monthlyRate = annualRate / 12;
  const monthlyInstallment = Math.round(((principalAmount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / (Math.pow(1 + monthlyRate, termMonths) - 1)) * 100) / 100;
  const totalAmountExpected = Math.round(monthlyInstallment * termMonths * 100) / 100;
  const totalInterestExpected = Math.round((totalAmountExpected - principalAmount) * 100) / 100;

  const loan1 = await prisma.loan.create({
    data: {
      loanNumber: 'LN-2026-0042',
      customerId: customerRecord.id,
      applicationId: application1.id,
      loanProductId: smeProduct.id,
      branchId: pacificBranch.id,
      principalAmount,
      interestRate: annualRate,
      termMonths,
      repaymentFrequency: RepaymentFrequency.MONTHLY,
      totalInterestExpected,
      totalFeesExpected: 2000.00, // $1500 processing + $500 insurance
      totalPenaltiesAccrued: 0.00,
      totalAmountExpected: totalAmountExpected + 2000.00,
      outstandingPrincipal: 77258.42,
      outstandingInterest: 5894.20,
      outstandingFees: 0.00,
      outstandingPenalties: 0.00,
      totalOutstandingBalance: 83152.62,
      totalPaidPrincipal: 22741.58,
      totalPaidInterest: 3515.80,
      totalPaidFees: 2000.00,
      totalPaidPenalties: 0.00,
      totalPaidAmount: 28257.38,
      monthlyInstallment,
      status: LoanStatus.ACTIVE,
      approvalDate: new Date('2026-01-15T14:30:00Z'),
      disbursementDate: new Date('2026-01-20T10:00:00Z'),
      maturityDate: new Date('2028-01-20'),
    },
  });

  // 10. Seed Loan Disbursement
  await prisma.loanDisbursement.create({
    data: {
      disbursementReference: 'DISB-2026-0042',
      loanId: loan1.id,
      amount: 100000.00,
      disbursementDate: new Date('2026-01-20T10:00:00Z'),
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      channelDetails: 'Federal Reserve Fedwire Funds Service',
      destinationAccount: 'JPMorgan Chase Bank •••• 9821',
      disbursedByStaffId: officerUser.staffProfile!.id,
      status: DisbursementStatus.PROCESSED,
      notes: 'Capital facility disbursed in full directly to borrower operating account.',
    },
  });
  console.log(`✓ Seeded master loan ledger record and disbursement transaction`);

  // 11. Seed Collateral & Guarantor
  await prisma.collateral.create({
    data: {
      loanId: loan1.id,
      loanApplicationId: application1.id,
      customerId: customerRecord.id,
      collateralType: CollateralType.REAL_ESTATE,
      description: 'Commercial Logistics Warehouse Facility (Bay 4-6, Seattle Port Corridor)',
      serialOrRegistrationNumber: 'KING-COUNTY-PARCEL-882910-A',
      valuationAmount: 420000.00,
      valuationDate: new Date('2025-11-15'),
      valuerName: 'Colliers International Appraisal Group',
      pledgedAmount: 150000.00,
      status: CollateralStatus.PLEDGED,
      storageLocation: 'Central Vault Deed Safe #4',
    },
  });

  await prisma.loanGuarantor.create({
    data: {
      loanId: loan1.id,
      loanApplicationId: application1.id,
      name: 'Robert Vance Sterling',
      idNumber: 'PASSPORT-A9928102',
      phone: '+1 (555) 012-9988',
      email: 'robert.sterling@sterlingholdings.com',
      relationship: 'Commercial Business Partner',
      employerName: 'Sterling Pacific Holdings Inc.',
      monthlyIncome: 25000.00,
      guaranteedAmount: 50000.00,
      status: GuarantorStatus.ACCEPTED,
      notes: 'Corporate partner guarantee deed executed under legal seal.',
    },
  });
  console.log(`✓ Seeded collateral and corporate guarantor records`);

  // 12. Seed 24 Repayment Schedules (Installments 1-6 Paid, 7-24 Scheduled)
  let curRemainingPrincipal = principalAmount;
  const scheduleRecords = [];

  for (let i = 1; i <= termMonths; i++) {
    const interestPortion = Math.round(curRemainingPrincipal * monthlyRate * 100) / 100;
    const principalPortion = i === termMonths
      ? Math.round(curRemainingPrincipal * 100) / 100
      : Math.round((monthlyInstallment - interestPortion) * 100) / 100;
    const totalDue = Math.round((principalPortion + interestPortion) * 100) / 100;
    curRemainingPrincipal = Math.max(0, curRemainingPrincipal - principalPortion);

    const dueDate = new Date('2026-01-20');
    dueDate.setMonth(dueDate.getMonth() + i);

    const isPaid = i <= 6;
    const sched = await prisma.repaymentSchedule.create({
      data: {
        loanId: loan1.id,
        installmentNumber: i,
        dueDate,
        principalDue: principalPortion,
        interestDue: interestPortion,
        feesDue: 0.00,
        penaltyDue: 0.00,
        totalDue,
        principalPaid: isPaid ? principalPortion : 0.00,
        interestPaid: isPaid ? interestPortion : 0.00,
        feesPaid: 0.00,
        penaltyPaid: 0.00,
        totalPaid: isPaid ? totalDue : 0.00,
        outstandingAmount: isPaid ? 0.00 : totalDue,
        status: isPaid ? RepaymentScheduleStatus.PAID : RepaymentScheduleStatus.SCHEDULED,
        paidDate: isPaid ? dueDate : null,
      },
    });
    scheduleRecords.push(sched);
  }
  console.log(`✓ Seeded 24 repayment schedule installments with exact decimal amortization`);

  // 13. Seed Payments & Multi-component Allocations
  for (let i = 1; i <= 6; i++) {
    const sched = scheduleRecords[i - 1];
    const payment = await prisma.payment.create({
      data: {
        paymentReference: `PAY-2026-${String(1000 + i)}`,
        receiptNumber: `RCP-NEXA-2026-00${i}`,
        customerId: customerRecord.id,
        loanId: loan1.id,
        amount: sched.totalDue,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        transactionReference: `ACH-TR-982100${i}`,
        paymentDate: sched.dueDate,
        receivedByStaffId: officerUser.staffProfile!.id,
        allocationStatus: PaymentAllocationStatus.FULLY_ALLOCATED,
        notes: `Monthly direct ACH debit for Installment #${i}`,
      },
    });

    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        repaymentScheduleId: sched.id,
        principalAllocated: sched.principalDue,
        interestAllocated: sched.interestDue,
        feesAllocated: 0.00,
        penaltyAllocated: 0.00,
        totalAllocated: sched.totalDue,
        allocatedAt: sched.dueDate,
      },
    });
  }
  console.log(`✓ Seeded payments and multi-component allocations for installments 1-6`);

  // 14. Seed Penalty Record
  await prisma.penalty.create({
    data: {
      loanId: loan1.id,
      repaymentScheduleId: scheduleRecords[6].id,
      penaltyType: PenaltyType.LATE_PAYMENT,
      reason: 'Standard 5-day grace period expired without cleared payment',
      amount: 150.00,
      paidAmount: 0.00,
      waivedAmount: 150.00,
      remainingAmount: 0.00,
      status: PenaltyStatus.WAIVED,
      waivedByStaffId: adminUser.staffProfile!.id,
      waiverReason: 'First-time bank clearing delay resolved with proof of ACH wire initiation',
      waivedAt: new Date('2026-08-01'),
    },
  });
  console.log(`✓ Seeded penalty record with audit waiver history`);

  // 15. Seed Customer Documents
  await prisma.customerDocument.createMany({
    data: [
      {
        customerId: customerRecord.id,
        loanApplicationId: application1.id,
        loanId: loan1.id,
        documentType: DocumentType.NATIONAL_ID,
        documentName: 'Alexander_Hayes_National_Identity_Card.pdf',
        fileUrl: 'https://documents.nexa.financial/vault/cust-0091/national_id.pdf',
        fileKey: 'vault/cust-0091/national_id.pdf',
        fileSizeBytes: 2450000,
        mimeType: 'application/pdf',
        verificationStatus: DocumentVerificationStatus.VERIFIED,
        verifiedByStaffId: officerUser.staffProfile!.id,
        verifiedAt: new Date('2026-01-12'),
      },
      {
        customerId: customerRecord.id,
        loanApplicationId: application1.id,
        documentType: DocumentType.TAX_RETURN,
        documentName: 'Apex_Logistics_Audited_Financials_FY2025.pdf',
        fileUrl: 'https://documents.nexa.financial/vault/cust-0091/audited_financials_2025.pdf',
        fileKey: 'vault/cust-0091/audited_financials_2025.pdf',
        fileSizeBytes: 8900000,
        mimeType: 'application/pdf',
        verificationStatus: DocumentVerificationStatus.VERIFIED,
        verifiedByStaffId: creditOfficerUser.staffProfile!.id,
        verifiedAt: new Date('2026-01-14'),
      },
    ],
  });
  console.log(`✓ Seeded verified customer documents in Document Vault`);

  // 16. Seed Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: customerUser.id,
        customerId: customerRecord.id,
        channel: NotificationChannel.EMAIL,
        subject: 'Credit Facility Approved: NLMS-2026-0042',
        message: 'Your commercial loan application for $100,000 has been formally approved by the Credit Committee.',
        status: NotificationStatus.SENT,
        sentAt: new Date('2026-01-15T15:00:00Z'),
        readAt: new Date('2026-01-15T16:20:00Z'),
      },
      {
        userId: customerUser.id,
        customerId: customerRecord.id,
        channel: NotificationChannel.SMS,
        subject: 'Disbursement Confirmation',
        message: 'Funds transfer of $100,000.00 has been sent to JPMorgan Chase •••• 9821. Ref: DISB-2026-0042.',
        status: NotificationStatus.DELIVERED,
        sentAt: new Date('2026-01-20T10:05:00Z'),
      },
    ],
  });
  console.log(`✓ Seeded customer notification log`);

  // 17. Seed Compliance Audit Trail
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: 'USER_LOGIN',
        entity: 'User',
        entityId: adminUser.id,
        previousValuesJson: null,
        newValuesJson: JSON.stringify({ email: adminUser.email, role: 'ADMIN' }),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        userId: officerUser.id,
        action: 'LOAN_APPLICATION_CREATED',
        entity: 'LoanApplication',
        entityId: application1.id,
        previousValuesJson: null,
        newValuesJson: JSON.stringify({ applicationNumber: application1.applicationNumber, amount: 100000.00 }),
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      {
        userId: adminUser.id,
        action: 'LOAN_APPLICATION_APPROVED',
        entity: 'LoanApplication',
        entityId: application1.id,
        previousValuesJson: JSON.stringify({ status: 'UNDER_REVIEW' }),
        newValuesJson: JSON.stringify({ status: 'APPROVED', approvedAmount: 100000.00, approvedRate: 0.0875 }),
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    ],
  });
  console.log(`✓ Seeded immutable compliance audit trail`);

  // 18. Seed System Settings
  const settingsData = [
    { key: 'institution_legal_name', value: 'Nexa Financial Capital Corp', description: 'Institutional registered legal entity name', group: SystemSettingGroup.GENERAL },
    { key: 'base_currency_code', value: 'USD', description: 'Base ISO 4217 currency code for accounting', group: SystemSettingGroup.ACCOUNTING },
    { key: 'default_grace_period_days', value: '5', description: 'Default grace period before late penalty assessment', group: SystemSettingGroup.LOAN_DEFAULTS },
    { key: 'default_penalty_rate_annual', value: '0.05', description: 'Default annual late fee penalty percentage', group: SystemSettingGroup.LOAN_DEFAULTS },
    { key: 'max_single_borrower_exposure', value: '2500000.00', description: 'Regulatory limit on aggregate credit exposure to single legal entity', group: SystemSettingGroup.SECURITY },
  ];

  for (const s of settingsData) {
    await prisma.systemSetting.create({
      data: {
        ...s,
        updatedByUserId: adminUser.id,
      },
    });
  }
  console.log(`✓ Seeded ${settingsData.length} core institutional system settings`);

  console.log('✅ Complete 21-entity database seed executed successfully!');
}

if (process.argv[1]?.includes('seed')) {
  main()
    .catch((e) => {
      console.error('❌ Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
