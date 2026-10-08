-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `module` VARCHAR(60) NOT NULL,
    `description` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    INDEX `permissions_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` VARCHAR(36) NOT NULL,
    `roleId` VARCHAR(36) NOT NULL,
    `permissionId` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permissions_roleId_idx`(`roleId`),
    INDEX `role_permissions_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `role_permissions_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `roleId` VARCHAR(36) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'INACTIVE', 'LOCKED', 'PENDING_VERIFICATION') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `loginAttempts` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_roleId_idx`(`roleId`),
    INDEX `users_status_idx`(`status`),
    INDEX `users_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `id` VARCHAR(36) NOT NULL,
    `branchCode` VARCHAR(30) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `email` VARCHAR(191) NULL,
    `addressLine1` VARCHAR(255) NOT NULL,
    `addressLine2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `postalCode` VARCHAR(20) NULL,
    `country` VARCHAR(60) NOT NULL DEFAULT 'US',
    `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `branches_branchCode_key`(`branchCode`),
    INDEX `branches_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `staff` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `branchId` VARCHAR(36) NOT NULL,
    `staffNumber` VARCHAR(40) NOT NULL,
    `firstName` VARCHAR(80) NOT NULL,
    `lastName` VARCHAR(80) NOT NULL,
    `middleName` VARCHAR(80) NULL,
    `phone` VARCHAR(40) NOT NULL,
    `department` VARCHAR(80) NOT NULL,
    `designation` VARCHAR(80) NOT NULL,
    `employmentStatus` ENUM('ACTIVE', 'ON_LEAVE', 'PROBATION', 'SUSPENDED', 'TERMINATED', 'RESIGNED') NOT NULL DEFAULT 'ACTIVE',
    `dateOfHire` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `staff_userId_key`(`userId`),
    UNIQUE INDEX `staff_staffNumber_key`(`staffNumber`),
    INDEX `staff_branchId_idx`(`branchId`),
    INDEX `staff_employmentStatus_idx`(`employmentStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(36) NOT NULL,
    `customerNumber` VARCHAR(40) NOT NULL,
    `userId` VARCHAR(36) NULL,
    `branchId` VARCHAR(36) NOT NULL,
    `firstName` VARCHAR(80) NOT NULL,
    `lastName` VARCHAR(80) NOT NULL,
    `middleName` VARCHAR(80) NULL,
    `dateOfBirth` DATE NOT NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY') NOT NULL,
    `maritalStatus` ENUM('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'SEPARATED') NOT NULL DEFAULT 'SINGLE',
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `alternatePhone` VARCHAR(40) NULL,
    `idType` ENUM('NATIONAL_ID', 'PASSPORT', 'DRIVERS_LICENSE', 'VOTER_ID', 'TAX_IDENTIFICATION_NUMBER', 'OTHER') NOT NULL DEFAULT 'NATIONAL_ID',
    `idNumber` VARCHAR(80) NOT NULL,
    `idIssueDate` DATE NULL,
    `idExpiryDate` DATE NULL,
    `addressLine1` VARCHAR(255) NOT NULL,
    `addressLine2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `postalCode` VARCHAR(20) NULL,
    `country` VARCHAR(60) NOT NULL DEFAULT 'US',
    `employmentType` ENUM('FULL_TIME_SALARIED', 'PART_TIME_SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'CONTRACTOR', 'RETIRED', 'UNEMPLOYED') NOT NULL DEFAULT 'FULL_TIME_SALARIED',
    `employerName` VARCHAR(150) NULL,
    `jobTitle` VARCHAR(100) NULL,
    `monthlyIncome` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `businessName` VARCHAR(150) NULL,
    `businessAddress` VARCHAR(255) NULL,
    `emergencyContactName` VARCHAR(120) NULL,
    `emergencyContactRelationship` VARCHAR(60) NULL,
    `emergencyContactPhone` VARCHAR(40) NULL,
    `profileStatus` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED', 'DECEASED') NOT NULL DEFAULT 'ACTIVE',
    `kycStatus` ENUM('NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `creditScore` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customers_customerNumber_key`(`customerNumber`),
    UNIQUE INDEX `customers_userId_key`(`userId`),
    UNIQUE INDEX `customers_email_key`(`email`),
    INDEX `customers_branchId_idx`(`branchId`),
    INDEX `customers_profileStatus_idx`(`profileStatus`),
    INDEX `customers_kycStatus_idx`(`kycStatus`),
    INDEX `customers_phone_idx`(`phone`),
    INDEX `customers_lastName_firstName_idx`(`lastName`, `firstName`),
    UNIQUE INDEX `customers_idType_idNumber_key`(`idType`, `idNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_products` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `description` TEXT NULL,
    `minAmount` DECIMAL(16, 2) NOT NULL,
    `maxAmount` DECIMAL(16, 2) NOT NULL,
    `minTermMonths` INTEGER NOT NULL,
    `maxTermMonths` INTEGER NOT NULL,
    `defaultInterestRate` DECIMAL(6, 4) NOT NULL,
    `interestCalculationMethod` ENUM('FLAT_RATE', 'REDUCING_BALANCE_EQUAL_INSTALLMENTS', 'REDUCING_BALANCE_EQUAL_PRINCIPAL', 'COMPOUND_INTEREST') NOT NULL DEFAULT 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    `repaymentFrequency` ENUM('DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'BULLET_AT_MATURITY') NOT NULL DEFAULT 'MONTHLY',
    `processingFeeType` ENUM('FIXED_AMOUNT', 'PERCENTAGE_OF_PRINCIPAL') NOT NULL DEFAULT 'PERCENTAGE_OF_PRINCIPAL',
    `processingFeeValue` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `insuranceFeeType` ENUM('FIXED_AMOUNT', 'PERCENTAGE_OF_PRINCIPAL') NOT NULL DEFAULT 'PERCENTAGE_OF_PRINCIPAL',
    `insuranceFeeValue` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `penaltyRate` DECIMAL(6, 4) NOT NULL DEFAULT 0.0500,
    `gracePeriodDays` INTEGER NOT NULL DEFAULT 5,
    `principalGracePeriodMonths` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loan_products_code_key`(`code`),
    INDEX `loan_products_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interest_rates` (
    `id` VARCHAR(36) NOT NULL,
    `loanProductId` VARCHAR(36) NOT NULL,
    `tierName` VARCHAR(80) NOT NULL,
    `minAmount` DECIMAL(16, 2) NOT NULL,
    `maxAmount` DECIMAL(16, 2) NOT NULL,
    `minTermMonths` INTEGER NOT NULL,
    `maxTermMonths` INTEGER NOT NULL,
    `rate` DECIMAL(6, 4) NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `interest_rates_loanProductId_idx`(`loanProductId`),
    INDEX `interest_rates_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_applications` (
    `id` VARCHAR(36) NOT NULL,
    `applicationNumber` VARCHAR(40) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `loanProductId` VARCHAR(36) NOT NULL,
    `branchId` VARCHAR(36) NOT NULL,
    `requestedAmount` DECIMAL(16, 2) NOT NULL,
    `requestedTermMonths` INTEGER NOT NULL,
    `purpose` TEXT NOT NULL,
    `applicationDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPRAISAL_IN_PROGRESS', 'COMMITTEE_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `loanOfficerId` VARCHAR(36) NULL,
    `creditOfficerId` VARCHAR(36) NULL,
    `approvedByStaffId` VARCHAR(36) NULL,
    `approvedAmount` DECIMAL(16, 2) NULL,
    `approvedTermMonths` INTEGER NULL,
    `approvedInterestRate` DECIMAL(6, 4) NULL,
    `approvalDate` DATETIME(3) NULL,
    `approvalNotes` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `rejectionDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loan_applications_applicationNumber_key`(`applicationNumber`),
    INDEX `loan_applications_customerId_idx`(`customerId`),
    INDEX `loan_applications_loanProductId_idx`(`loanProductId`),
    INDEX `loan_applications_branchId_idx`(`branchId`),
    INDEX `loan_applications_status_idx`(`status`),
    INDEX `loan_applications_applicationDate_idx`(`applicationDate`),
    INDEX `loan_applications_loanOfficerId_idx`(`loanOfficerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` VARCHAR(36) NOT NULL,
    `loanNumber` VARCHAR(40) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `applicationId` VARCHAR(36) NULL,
    `loanProductId` VARCHAR(36) NOT NULL,
    `branchId` VARCHAR(36) NOT NULL,
    `principalAmount` DECIMAL(16, 2) NOT NULL,
    `interestRate` DECIMAL(6, 4) NOT NULL,
    `termMonths` INTEGER NOT NULL,
    `repaymentFrequency` ENUM('DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'BULLET_AT_MATURITY') NOT NULL DEFAULT 'MONTHLY',
    `totalInterestExpected` DECIMAL(16, 2) NOT NULL,
    `totalFeesExpected` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalPenaltiesAccrued` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalAmountExpected` DECIMAL(16, 2) NOT NULL,
    `outstandingPrincipal` DECIMAL(16, 2) NOT NULL,
    `outstandingInterest` DECIMAL(16, 2) NOT NULL,
    `outstandingFees` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `outstandingPenalties` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalOutstandingBalance` DECIMAL(16, 2) NOT NULL,
    `totalPaidPrincipal` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalPaidInterest` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalPaidFees` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalPaidPenalties` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalPaidAmount` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `monthlyInstallment` DECIMAL(16, 2) NOT NULL,
    `status` ENUM('PENDING_DISBURSEMENT', 'ACTIVE', 'IN_ARREARS', 'DELINQUENT', 'DEFAULTED', 'RESTRUCTURED', 'CLOSED_PAID_OFF', 'WRITTEN_OFF') NOT NULL DEFAULT 'PENDING_DISBURSEMENT',
    `approvalDate` DATETIME(3) NULL,
    `disbursementDate` DATETIME(3) NULL,
    `maturityDate` DATE NULL,
    `closedDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loans_loanNumber_key`(`loanNumber`),
    UNIQUE INDEX `loans_applicationId_key`(`applicationId`),
    INDEX `loans_customerId_idx`(`customerId`),
    INDEX `loans_loanProductId_idx`(`loanProductId`),
    INDEX `loans_branchId_idx`(`branchId`),
    INDEX `loans_status_idx`(`status`),
    INDEX `loans_disbursementDate_idx`(`disbursementDate`),
    INDEX `loans_maturityDate_idx`(`maturityDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_guarantors` (
    `id` VARCHAR(36) NOT NULL,
    `loanId` VARCHAR(36) NULL,
    `loanApplicationId` VARCHAR(36) NULL,
    `customerId` VARCHAR(36) NULL,
    `name` VARCHAR(120) NOT NULL,
    `idNumber` VARCHAR(60) NOT NULL,
    `phone` VARCHAR(40) NOT NULL,
    `email` VARCHAR(191) NULL,
    `relationship` VARCHAR(60) NOT NULL,
    `employerName` VARCHAR(140) NULL,
    `monthlyIncome` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `guaranteedAmount` DECIMAL(16, 2) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'RELEASED') NOT NULL DEFAULT 'PENDING',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `loan_guarantors_loanId_idx`(`loanId`),
    INDEX `loan_guarantors_loanApplicationId_idx`(`loanApplicationId`),
    INDEX `loan_guarantors_customerId_idx`(`customerId`),
    INDEX `loan_guarantors_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collaterals` (
    `id` VARCHAR(36) NOT NULL,
    `loanId` VARCHAR(36) NULL,
    `loanApplicationId` VARCHAR(36) NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `collateralType` ENUM('REAL_ESTATE', 'VEHICLE', 'EQUIPMENT', 'FINANCIAL_ASSET', 'INVENTORY', 'LIVESTOCK', 'CHATTEL', 'OTHER') NOT NULL DEFAULT 'VEHICLE',
    `description` TEXT NOT NULL,
    `serialOrRegistrationNumber` VARCHAR(100) NULL,
    `valuationAmount` DECIMAL(16, 2) NOT NULL,
    `valuationDate` DATE NOT NULL,
    `valuerName` VARCHAR(120) NULL,
    `pledgedAmount` DECIMAL(16, 2) NOT NULL,
    `status` ENUM('PLEDGED', 'DEPOSITED', 'HELD', 'RELEASED', 'FORFEITED', 'LIQUIDATED') NOT NULL DEFAULT 'PLEDGED',
    `storageLocation` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `collaterals_loanId_idx`(`loanId`),
    INDEX `collaterals_loanApplicationId_idx`(`loanApplicationId`),
    INDEX `collaterals_customerId_idx`(`customerId`),
    INDEX `collaterals_collateralType_idx`(`collateralType`),
    INDEX `collaterals_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_disbursements` (
    `id` VARCHAR(36) NOT NULL,
    `disbursementReference` VARCHAR(60) NOT NULL,
    `loanId` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `disbursementDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentMethod` ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'ONLINE_CARD', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `channelDetails` VARCHAR(120) NULL,
    `destinationAccount` VARCHAR(100) NULL,
    `disbursedByStaffId` VARCHAR(36) NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'REVERSED') NOT NULL DEFAULT 'PROCESSED',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loan_disbursements_disbursementReference_key`(`disbursementReference`),
    INDEX `loan_disbursements_loanId_idx`(`loanId`),
    INDEX `loan_disbursements_disbursementDate_idx`(`disbursementDate`),
    INDEX `loan_disbursements_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `repayment_schedules` (
    `id` VARCHAR(36) NOT NULL,
    `loanId` VARCHAR(36) NOT NULL,
    `installmentNumber` INTEGER NOT NULL,
    `dueDate` DATE NOT NULL,
    `principalDue` DECIMAL(16, 2) NOT NULL,
    `interestDue` DECIMAL(16, 2) NOT NULL,
    `feesDue` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `penaltyDue` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalDue` DECIMAL(16, 2) NOT NULL,
    `principalPaid` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `interestPaid` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `feesPaid` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `penaltyPaid` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalPaid` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `outstandingAmount` DECIMAL(16, 2) NOT NULL,
    `status` ENUM('SCHEDULED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED') NOT NULL DEFAULT 'SCHEDULED',
    `paidDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `repayment_schedules_loanId_idx`(`loanId`),
    INDEX `repayment_schedules_dueDate_idx`(`dueDate`),
    INDEX `repayment_schedules_status_idx`(`status`),
    UNIQUE INDEX `repayment_schedules_loanId_installmentNumber_key`(`loanId`, `installmentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(36) NOT NULL,
    `paymentReference` VARCHAR(60) NOT NULL,
    `receiptNumber` VARCHAR(60) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `loanId` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(16, 2) NOT NULL,
    `paymentMethod` ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'ONLINE_CARD', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `transactionReference` VARCHAR(100) NULL,
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedByStaffId` VARCHAR(36) NULL,
    `allocationStatus` ENUM('UNALLOCATED', 'PARTIALLY_ALLOCATED', 'FULLY_ALLOCATED', 'REVERSED') NOT NULL DEFAULT 'UNALLOCATED',
    `notes` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_paymentReference_key`(`paymentReference`),
    UNIQUE INDEX `payments_receiptNumber_key`(`receiptNumber`),
    INDEX `payments_customerId_idx`(`customerId`),
    INDEX `payments_loanId_idx`(`loanId`),
    INDEX `payments_paymentDate_idx`(`paymentDate`),
    INDEX `payments_allocationStatus_idx`(`allocationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` VARCHAR(36) NOT NULL,
    `paymentId` VARCHAR(36) NOT NULL,
    `repaymentScheduleId` VARCHAR(36) NOT NULL,
    `principalAllocated` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `interestAllocated` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `feesAllocated` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `penaltyAllocated` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `totalAllocated` DECIMAL(16, 2) NOT NULL,
    `allocatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_allocations_paymentId_idx`(`paymentId`),
    INDEX `payment_allocations_repaymentScheduleId_idx`(`repaymentScheduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `penalties` (
    `id` VARCHAR(36) NOT NULL,
    `loanId` VARCHAR(36) NOT NULL,
    `repaymentScheduleId` VARCHAR(36) NULL,
    `penaltyType` ENUM('LATE_PAYMENT', 'DEFAULT', 'DISHONOURED_PAYMENT', 'COVENANT_BREACH') NOT NULL DEFAULT 'LATE_PAYMENT',
    `reason` VARCHAR(255) NOT NULL,
    `assessedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `amount` DECIMAL(16, 2) NOT NULL,
    `paidAmount` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `waivedAmount` DECIMAL(16, 2) NOT NULL DEFAULT 0.00,
    `remainingAmount` DECIMAL(16, 2) NOT NULL,
    `status` ENUM('ASSESSED', 'PARTIALLY_PAID', 'PAID', 'WAIVED', 'CANCELLED') NOT NULL DEFAULT 'ASSESSED',
    `waivedByStaffId` VARCHAR(36) NULL,
    `waiverReason` TEXT NULL,
    `waivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `penalties_loanId_idx`(`loanId`),
    INDEX `penalties_repaymentScheduleId_idx`(`repaymentScheduleId`),
    INDEX `penalties_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_documents` (
    `id` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `loanApplicationId` VARCHAR(36) NULL,
    `loanId` VARCHAR(36) NULL,
    `documentType` ENUM('NATIONAL_ID', 'PASSPORT', 'PROOF_OF_RESIDENCE', 'PAYSLIP', 'BANK_STATEMENT', 'TAX_RETURN', 'BUSINESS_REGISTRATION', 'COLLATERAL_TITLE_DEED', 'VEHICLE_LOGBOOK', 'GUARANTOR_FORM', 'LOAN_AGREEMENT', 'CREDIT_REPORT', 'OTHER') NOT NULL DEFAULT 'NATIONAL_ID',
    `documentName` VARCHAR(180) NOT NULL,
    `fileUrl` VARCHAR(500) NOT NULL,
    `fileKey` VARCHAR(255) NULL,
    `fileSizeBytes` INTEGER NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `verificationStatus` ENUM('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `verifiedByStaffId` VARCHAR(36) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `customer_documents_customerId_idx`(`customerId`),
    INDEX `customer_documents_loanApplicationId_idx`(`loanApplicationId`),
    INDEX `customer_documents_loanId_idx`(`loanId`),
    INDEX `customer_documents_verificationStatus_idx`(`verificationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NULL,
    `channel` ENUM('SMS', 'EMAIL', 'IN_APP', 'PUSH') NOT NULL DEFAULT 'IN_APP',
    `subject` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'DELIVERED', 'FAILED') NOT NULL DEFAULT 'SENT',
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_idx`(`userId`),
    INDEX `notifications_customerId_idx`(`customerId`),
    INDEX `notifications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity` VARCHAR(80) NOT NULL,
    `entityId` VARCHAR(80) NULL,
    `previousValuesJson` LONGTEXT NULL,
    `newValuesJson` LONGTEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(255) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_userId_idx`(`userId`),
    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_entity_entityId_idx`(`entity`, `entityId`),
    INDEX `audit_logs_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `description` VARCHAR(255) NULL,
    `group` ENUM('GENERAL', 'LOAN_DEFAULTS', 'ACCOUNTING', 'NOTIFICATIONS', 'SECURITY') NOT NULL DEFAULT 'GENERAL',
    `isEncrypted` BOOLEAN NOT NULL DEFAULT false,
    `updatedByUserId` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_key_key`(`key`),
    INDEX `system_settings_group_idx`(`group`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff` ADD CONSTRAINT `staff_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interest_rates` ADD CONSTRAINT `interest_rates_loanProductId_fkey` FOREIGN KEY (`loanProductId`) REFERENCES `loan_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_loanProductId_fkey` FOREIGN KEY (`loanProductId`) REFERENCES `loan_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_loanOfficerId_fkey` FOREIGN KEY (`loanOfficerId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_creditOfficerId_fkey` FOREIGN KEY (`creditOfficerId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_applications` ADD CONSTRAINT `loan_applications_approvedByStaffId_fkey` FOREIGN KEY (`approvedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `loan_applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_loanProductId_fkey` FOREIGN KEY (`loanProductId`) REFERENCES `loan_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_guarantors` ADD CONSTRAINT `loan_guarantors_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_guarantors` ADD CONSTRAINT `loan_guarantors_loanApplicationId_fkey` FOREIGN KEY (`loanApplicationId`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_guarantors` ADD CONSTRAINT `loan_guarantors_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collaterals` ADD CONSTRAINT `collaterals_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collaterals` ADD CONSTRAINT `collaterals_loanApplicationId_fkey` FOREIGN KEY (`loanApplicationId`) REFERENCES `loan_applications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collaterals` ADD CONSTRAINT `collaterals_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_disbursements` ADD CONSTRAINT `loan_disbursements_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_disbursements` ADD CONSTRAINT `loan_disbursements_disbursedByStaffId_fkey` FOREIGN KEY (`disbursedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `repayment_schedules` ADD CONSTRAINT `repayment_schedules_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_receivedByStaffId_fkey` FOREIGN KEY (`receivedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_repaymentScheduleId_fkey` FOREIGN KEY (`repaymentScheduleId`) REFERENCES `repayment_schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penalties` ADD CONSTRAINT `penalties_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penalties` ADD CONSTRAINT `penalties_repaymentScheduleId_fkey` FOREIGN KEY (`repaymentScheduleId`) REFERENCES `repayment_schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penalties` ADD CONSTRAINT `penalties_waivedByStaffId_fkey` FOREIGN KEY (`waivedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_documents` ADD CONSTRAINT `customer_documents_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_documents` ADD CONSTRAINT `customer_documents_loanApplicationId_fkey` FOREIGN KEY (`loanApplicationId`) REFERENCES `loan_applications`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_documents` ADD CONSTRAINT `customer_documents_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_documents` ADD CONSTRAINT `customer_documents_verifiedByStaffId_fkey` FOREIGN KEY (`verifiedByStaffId`) REFERENCES `staff`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updatedByUserId_fkey` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

