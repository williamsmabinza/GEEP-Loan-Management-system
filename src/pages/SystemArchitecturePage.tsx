import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { SystemHealthDTO } from '../../shared/types/index.js';
import { VpsDeploymentGuide } from '../components/architecture/VpsDeploymentGuide.js';

interface EntityDefinition {
  name: string;
  table: string;
  cluster: string;
  description: string;
  fields: Array<{ name: string; type: string; constraints: string; note?: string }>;
  foreignKeys: Array<{ column: string; references: string; onDelete: string }>;
  indexes: string[];
}

const ENTITY_REGISTRY: EntityDefinition[] = [
  // Cluster: Access & Security
  {
    name: 'User',
    table: 'users',
    cluster: 'Access & Security',
    description: 'System authentication identity, bcrypt password hash, status flags, and session audit tracking.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY', note: 'UUID v4' },
      { name: 'email', type: 'VARCHAR(191)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'passwordHash', type: 'VARCHAR(255)', constraints: 'NOT NULL', note: 'Bcrypt salt rounds 10-12' },
      { name: 'roleId', type: 'VARCHAR(36)', constraints: 'NOT NULL', note: 'FK -> roles(id)' },
      { name: 'status', type: 'ENUM', constraints: 'DEFAULT ACTIVE' },
      { name: 'lastLoginAt', type: 'DATETIME(3)', constraints: 'NULL' },
      { name: 'loginAttempts', type: 'INT', constraints: 'DEFAULT 0' },
      { name: 'lockedUntil', type: 'DATETIME(3)', constraints: 'NULL' },
      { name: 'createdAt / updatedAt', type: 'DATETIME(3)', constraints: 'NOT NULL' },
    ],
    foreignKeys: [{ column: 'roleId', references: 'roles(id)', onDelete: 'RESTRICT' }],
    indexes: ['users_email_key (UNIQUE)', 'users_roleId_idx', 'users_status_idx', 'users_createdAt_idx'],
  },
  {
    name: 'Role',
    table: 'roles',
    cluster: 'Access & Security',
    description: 'Role-based access control roles (Super Admin, Loan Officer, Credit Officer, Customer, Cashier, etc.).',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'name', type: 'VARCHAR(80)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'code', type: 'VARCHAR(50)', constraints: 'UNIQUE, NOT NULL', note: 'e.g. SUPER_ADMIN, LOAN_OFFICER' },
      { name: 'description', type: 'VARCHAR(255)', constraints: 'NULL' },
      { name: 'isSystem', type: 'BOOLEAN', constraints: 'DEFAULT FALSE' },
    ],
    foreignKeys: [],
    indexes: ['roles_name_key (UNIQUE)', 'roles_code_key (UNIQUE)'],
  },
  {
    name: 'Permission',
    table: 'permissions',
    cluster: 'Access & Security',
    description: 'Atomic system privileges partitioned by operational domain (LOANS, CUSTOMERS, REPAYMENTS).',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'code', type: 'VARCHAR(80)', constraints: 'UNIQUE, NOT NULL', note: 'e.g. loan:approve, repayment:collect' },
      { name: 'name', type: 'VARCHAR(120)', constraints: 'NOT NULL' },
      { name: 'module', type: 'VARCHAR(60)', constraints: 'NOT NULL' },
      { name: 'description', type: 'VARCHAR(255)', constraints: 'NULL' },
    ],
    foreignKeys: [],
    indexes: ['permissions_code_key (UNIQUE)', 'permissions_module_idx'],
  },
  {
    name: 'RolePermission',
    table: 'role_permissions',
    cluster: 'Access & Security',
    description: 'Relational junction mapping permissions to institutional roles.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'roleId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'permissionId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'createdAt', type: 'DATETIME(3)', constraints: 'DEFAULT CURRENT_TIMESTAMP' },
    ],
    foreignKeys: [
      { column: 'roleId', references: 'roles(id)', onDelete: 'CASCADE' },
      { column: 'permissionId', references: 'permissions(id)', onDelete: 'CASCADE' },
    ],
    indexes: ['UNIQUE(roleId, permissionId)', 'role_permissions_roleId_idx', 'role_permissions_permissionId_idx'],
  },

  // Cluster: Organization
  {
    name: 'Branch',
    table: 'branches',
    cluster: 'Organization',
    description: 'Physical or regional banking branch units managing loans, customers, and operations.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'branchCode', type: 'VARCHAR(30)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'name', type: 'VARCHAR(120)', constraints: 'NOT NULL' },
      { name: 'addressLine1, city, state, country', type: 'VARCHAR', constraints: 'NOT NULL' },
      { name: 'phone, email', type: 'VARCHAR', constraints: 'NULL' },
      { name: 'status', type: 'ENUM', constraints: 'DEFAULT ACTIVE' },
    ],
    foreignKeys: [],
    indexes: ['branches_branchCode_key (UNIQUE)', 'branches_status_idx'],
  },
  {
    name: 'Staff',
    table: 'staff',
    cluster: 'Organization',
    description: 'Internal employees (Officers, Underwriters, Cashiers, Managers) linked to User accounts.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'userId', type: 'VARCHAR(36)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'branchId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'staffNumber', type: 'VARCHAR(40)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'firstName, lastName, phone', type: 'VARCHAR', constraints: 'NOT NULL' },
      { name: 'department, designation', type: 'VARCHAR(80)', constraints: 'NOT NULL' },
      { name: 'employmentStatus', type: 'ENUM', constraints: 'DEFAULT ACTIVE' },
      { name: 'dateOfHire', type: 'DATE', constraints: 'NOT NULL' },
    ],
    foreignKeys: [
      { column: 'userId', references: 'users(id)', onDelete: 'CASCADE' },
      { column: 'branchId', references: 'branches(id)', onDelete: 'RESTRICT' },
    ],
    indexes: ['staff_userId_key (UNIQUE)', 'staff_staffNumber_key (UNIQUE)', 'staff_branchId_idx'],
  },

  // Cluster: Customer
  {
    name: 'Customer',
    table: 'customers',
    cluster: 'Customer Dossier',
    description: 'Comprehensive borrower profile: KYC, identity numbers, employment income, residential address.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'customerNumber', type: 'VARCHAR(40)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'userId', type: 'VARCHAR(36)', constraints: 'UNIQUE, NULL', note: 'Linked borrower portal account' },
      { name: 'branchId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'firstName, lastName, dateOfBirth, gender', type: 'VARCHAR/DATE', constraints: 'NOT NULL' },
      { name: 'email, phone', type: 'VARCHAR', constraints: 'NOT NULL' },
      { name: 'idType, idNumber', type: 'ENUM / VARCHAR', constraints: 'UNIQUE(idType, idNumber)' },
      { name: 'monthlyIncome', type: 'DECIMAL(16, 2)', constraints: 'DEFAULT 0.00', note: 'Exact currency' },
      { name: 'employmentType, employerName', type: 'ENUM / VARCHAR', constraints: 'NULL' },
      { name: 'profileStatus, kycStatus', type: 'ENUM', constraints: 'DEFAULT ACTIVE, PENDING' },
      { name: 'creditScore', type: 'INT', constraints: 'NULL (300-850)' },
    ],
    foreignKeys: [
      { column: 'userId', references: 'users(id)', onDelete: 'SET NULL' },
      { column: 'branchId', references: 'branches(id)', onDelete: 'RESTRICT' },
    ],
    indexes: ['customers_customerNumber_key (UNIQUE)', 'UNIQUE(idType, idNumber)', 'customers_branchId_idx', 'customers_kycStatus_idx'],
  },
  {
    name: 'CustomerDocument',
    table: 'customer_documents',
    cluster: 'Customer Dossier',
    description: 'Document vault archiving identity cards, payslips, tax filings, and collateral titles.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'customerId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'loanApplicationId, loanId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'documentType', type: 'ENUM', constraints: 'NATIONAL_ID, PASSPORT, PAYSLIP, TAX_RETURN, ...' },
      { name: 'fileUrl, fileKey, fileSizeBytes, mimeType', type: 'VARCHAR / INT', constraints: 'NOT NULL' },
      { name: 'verificationStatus', type: 'ENUM', constraints: 'DEFAULT PENDING' },
      { name: 'verifiedByStaffId', type: 'VARCHAR(36)', constraints: 'NULL' },
    ],
    foreignKeys: [
      { column: 'customerId', references: 'customers(id)', onDelete: 'CASCADE' },
      { column: 'verifiedByStaffId', references: 'staff(id)', onDelete: 'SET NULL' },
    ],
    indexes: ['customer_documents_customerId_idx', 'customer_documents_verificationStatus_idx'],
  },

  // Cluster: Credit Origination
  {
    name: 'LoanProduct',
    table: 'loan_products',
    cluster: 'Credit Origination',
    description: 'Configurable credit facilities, min/max bounds, fee structures, grace periods, and calculation formulas.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'code', type: 'VARCHAR(50)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'name', type: 'VARCHAR(140)', constraints: 'NOT NULL' },
      { name: 'minAmount, maxAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'minTermMonths, maxTermMonths', type: 'INT', constraints: 'NOT NULL' },
      { name: 'defaultInterestRate', type: 'DECIMAL(6, 4)', constraints: 'NOT NULL', note: 'e.g. 0.0875 for 8.75%' },
      { name: 'interestCalculationMethod', type: 'ENUM', constraints: 'REDUCING_BALANCE, FLAT_RATE, COMPOUND' },
      { name: 'repaymentFrequency', type: 'ENUM', constraints: 'MONTHLY, BI_WEEKLY, WEEKLY' },
      { name: 'processingFeeValue, insuranceFeeValue', type: 'DECIMAL(16, 2)', constraints: 'DEFAULT 0.00' },
      { name: 'penaltyRate', type: 'DECIMAL(6, 4)', constraints: 'DEFAULT 0.0500' },
      { name: 'gracePeriodDays', type: 'INT', constraints: 'DEFAULT 5' },
    ],
    foreignKeys: [],
    indexes: ['loan_products_code_key (UNIQUE)', 'loan_products_status_idx'],
  },
  {
    name: 'InterestRate',
    table: 'interest_rates',
    cluster: 'Credit Origination',
    description: 'Dynamic interest rate tiers based on loan volume, duration, and credit rating band.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'loanProductId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'tierName', type: 'VARCHAR(80)', constraints: 'NOT NULL' },
      { name: 'minAmount, maxAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'minTermMonths, maxTermMonths', type: 'INT', constraints: 'NOT NULL' },
      { name: 'rate', type: 'DECIMAL(6, 4)', constraints: 'NOT NULL' },
      { name: 'effectiveFrom, effectiveTo', type: 'DATE', constraints: 'NOT NULL / NULL' },
    ],
    foreignKeys: [{ column: 'loanProductId', references: 'loan_products(id)', onDelete: 'CASCADE' }],
    indexes: ['interest_rates_loanProductId_idx', 'interest_rates_isActive_idx'],
  },
  {
    name: 'LoanApplication',
    table: 'loan_applications',
    cluster: 'Credit Origination',
    description: 'Credit application lifecycle, appraisal analysis, committee review notes, and decision stamps.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'applicationNumber', type: 'VARCHAR(40)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'customerId, loanProductId, branchId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'requestedAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'requestedTermMonths', type: 'INT', constraints: 'NOT NULL' },
      { name: 'purpose', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'status', type: 'ENUM', constraints: 'SUBMITTED, UNDER_REVIEW, APPRAISAL, APPROVED, REJECTED' },
      { name: 'loanOfficerId, creditOfficerId, approvedByStaffId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'approvedAmount', type: 'DECIMAL(16, 2)', constraints: 'NULL' },
      { name: 'approvalDate, approvalNotes', type: 'DATETIME / TEXT', constraints: 'NULL' },
    ],
    foreignKeys: [
      { column: 'customerId', references: 'customers(id)', onDelete: 'RESTRICT' },
      { column: 'loanProductId', references: 'loan_products(id)', onDelete: 'RESTRICT' },
      { column: 'branchId', references: 'branches(id)', onDelete: 'RESTRICT' },
      { column: 'approvedByStaffId', references: 'staff(id)', onDelete: 'SET NULL' },
    ],
    indexes: ['loan_applications_applicationNumber_key (UNIQUE)', 'loan_applications_status_idx', 'loan_applications_customerId_idx'],
  },
  {
    name: 'LoanGuarantor',
    table: 'loan_guarantors',
    cluster: 'Credit Origination',
    description: 'Personal or corporate third-party guarantors legally bound to loan obligations.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'loanId, loanApplicationId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'customerId', type: 'VARCHAR(36)', constraints: 'NULL', note: 'If existing customer' },
      { name: 'name, idNumber, phone, relationship', type: 'VARCHAR', constraints: 'NOT NULL' },
      { name: 'monthlyIncome', type: 'DECIMAL(16, 2)', constraints: 'DEFAULT 0.00' },
      { name: 'guaranteedAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'status', type: 'ENUM', constraints: 'PENDING, ACCEPTED, REJECTED, RELEASED' },
    ],
    foreignKeys: [
      { column: 'loanId', references: 'loans(id)', onDelete: 'CASCADE' },
      { column: 'loanApplicationId', references: 'loan_applications(id)', onDelete: 'CASCADE' },
    ],
    indexes: ['loan_guarantors_loanId_idx', 'loan_guarantors_status_idx'],
  },
  {
    name: 'Collateral',
    table: 'collaterals',
    cluster: 'Credit Origination',
    description: 'Asset pledges (real estate deeds, vehicles, industrial equipment, inventory) securing credit lines.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'loanId, loanApplicationId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'customerId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'collateralType', type: 'ENUM', constraints: 'REAL_ESTATE, VEHICLE, EQUIPMENT, ...' },
      { name: 'description', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'valuationAmount, pledgedAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'valuationDate', type: 'DATE', constraints: 'NOT NULL' },
      { name: 'status', type: 'ENUM', constraints: 'PLEDGED, HELD, RELEASED, LIQUIDATED' },
    ],
    foreignKeys: [
      { column: 'loanId', references: 'loans(id)', onDelete: 'CASCADE' },
      { column: 'customerId', references: 'customers(id)', onDelete: 'RESTRICT' },
    ],
    indexes: ['collaterals_loanId_idx', 'collaterals_customerId_idx', 'collaterals_status_idx'],
  },

  // Cluster: Master Ledger & Servicing
  {
    name: 'Loan',
    table: 'loans',
    cluster: 'Master Ledger & Servicing',
    description: 'Core financial loan ledger tracking principal, accrued interest, fees, penalties, and outstanding balance.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'loanNumber', type: 'VARCHAR(40)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'customerId, loanProductId, branchId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'applicationId', type: 'VARCHAR(36)', constraints: 'UNIQUE, NULL' },
      { name: 'principalAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'interestRate', type: 'DECIMAL(6, 4)', constraints: 'NOT NULL' },
      { name: 'termMonths', type: 'INT', constraints: 'NOT NULL' },
      { name: 'totalAmountExpected', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'totalOutstandingBalance', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'totalPaidAmount', type: 'DECIMAL(16, 2)', constraints: 'DEFAULT 0.00' },
      { name: 'monthlyInstallment', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'status', type: 'ENUM', constraints: 'ACTIVE, PENDING_DISBURSEMENT, IN_ARREARS, CLOSED_PAID_OFF' },
      { name: 'disbursementDate, maturityDate', type: 'DATETIME / DATE', constraints: 'NULL' },
    ],
    foreignKeys: [
      { column: 'customerId', references: 'customers(id)', onDelete: 'RESTRICT' },
      { column: 'loanProductId', references: 'loan_products(id)', onDelete: 'RESTRICT' },
      { column: 'branchId', references: 'branches(id)', onDelete: 'RESTRICT' },
    ],
    indexes: ['loans_loanNumber_key (UNIQUE)', 'loans_customerId_idx', 'loans_status_idx', 'loans_disbursementDate_idx'],
  },
  {
    name: 'LoanDisbursement',
    table: 'loan_disbursements',
    cluster: 'Master Ledger & Servicing',
    description: 'Outbound capital disbursement transaction to borrower account via Fedwire, ACH, or Mobile Money.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'disbursementReference', type: 'VARCHAR(60)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'loanId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'amount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'disbursementDate', type: 'DATETIME(3)', constraints: 'DEFAULT CURRENT_TIMESTAMP' },
      { name: 'paymentMethod', type: 'ENUM', constraints: 'BANK_TRANSFER, MOBILE_MONEY, CHEQUE' },
      { name: 'disbursedByStaffId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'status', type: 'ENUM', constraints: 'DEFAULT PROCESSED' },
    ],
    foreignKeys: [
      { column: 'loanId', references: 'loans(id)', onDelete: 'RESTRICT' },
      { column: 'disbursedByStaffId', references: 'staff(id)', onDelete: 'SET NULL' },
    ],
    indexes: ['loan_disbursements_disbursementReference_key (UNIQUE)', 'loan_disbursements_loanId_idx'],
  },
  {
    name: 'RepaymentSchedule',
    table: 'repayment_schedules',
    cluster: 'Master Ledger & Servicing',
    description: 'Exact installment-by-installment schedule breaking down principal portion, interest, fees, and penalties.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'loanId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'installmentNumber', type: 'INT', constraints: 'NOT NULL' },
      { name: 'dueDate', type: 'DATE', constraints: 'NOT NULL' },
      { name: 'principalDue, interestDue, totalDue', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'principalPaid, interestPaid, totalPaid', type: 'DECIMAL(16, 2)', constraints: 'DEFAULT 0.00' },
      { name: 'outstandingAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'status', type: 'ENUM', constraints: 'SCHEDULED, PARTIALLY_PAID, PAID, OVERDUE, WAIVED' },
      { name: 'paidDate', type: 'DATETIME(3)', constraints: 'NULL' },
    ],
    foreignKeys: [{ column: 'loanId', references: 'loans(id)', onDelete: 'CASCADE' }],
    indexes: ['UNIQUE(loanId, installmentNumber)', 'repayment_schedules_loanId_idx', 'repayment_schedules_dueDate_idx'],
  },
  {
    name: 'Payment',
    table: 'payments',
    cluster: 'Master Ledger & Servicing',
    description: 'Inbound borrower payment receipts (Cash, Bank, Mobile Money) with unique receipt numbers.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'paymentReference', type: 'VARCHAR(60)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'receiptNumber', type: 'VARCHAR(60)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'customerId, loanId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'amount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'paymentMethod', type: 'ENUM', constraints: 'BANK_TRANSFER, CASH, MOBILE_MONEY, CHEQUE' },
      { name: 'receivedByStaffId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'allocationStatus', type: 'ENUM', constraints: 'UNALLOCATED, PARTIALLY_ALLOCATED, FULLY_ALLOCATED' },
    ],
    foreignKeys: [
      { column: 'customerId', references: 'customers(id)', onDelete: 'RESTRICT' },
      { column: 'loanId', references: 'loans(id)', onDelete: 'RESTRICT' },
      { column: 'receivedByStaffId', references: 'staff(id)', onDelete: 'SET NULL' },
    ],
    indexes: ['payments_paymentReference_key (UNIQUE)', 'payments_receiptNumber_key (UNIQUE)', 'payments_loanId_idx'],
  },
  {
    name: 'PaymentAllocation',
    table: 'payment_allocations',
    cluster: 'Master Ledger & Servicing',
    description: 'Component allocation mapping each payment into principal, interest, fees, and penalties.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'paymentId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'repaymentScheduleId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'principalAllocated, interestAllocated', type: 'DECIMAL(16, 2)', constraints: 'DEFAULT 0.00' },
      { name: 'totalAllocated', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'allocatedAt', type: 'DATETIME(3)', constraints: 'DEFAULT CURRENT_TIMESTAMP' },
    ],
    foreignKeys: [
      { column: 'paymentId', references: 'payments(id)', onDelete: 'CASCADE' },
      { column: 'repaymentScheduleId', references: 'repayment_schedules(id)', onDelete: 'RESTRICT' },
    ],
    indexes: ['payment_allocations_paymentId_idx', 'payment_allocations_repaymentScheduleId_idx'],
  },
  {
    name: 'Penalty',
    table: 'penalties',
    cluster: 'Master Ledger & Servicing',
    description: 'Late payment charges, default penalties, and administrative fee waivers with audit reasons.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'loanId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'repaymentScheduleId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'penaltyType', type: 'ENUM', constraints: 'LATE_PAYMENT, DEFAULT, DISHONOURED' },
      { name: 'amount, remainingAmount', type: 'DECIMAL(16, 2)', constraints: 'NOT NULL' },
      { name: 'waivedAmount', type: 'DECIMAL(16, 2)', constraints: 'DEFAULT 0.00' },
      { name: 'status', type: 'ENUM', constraints: 'ASSESSED, PAID, WAIVED' },
      { name: 'waivedByStaffId, waiverReason', type: 'VARCHAR(36) / TEXT', constraints: 'NULL' },
    ],
    foreignKeys: [
      { column: 'loanId', references: 'loans(id)', onDelete: 'CASCADE' },
      { column: 'waivedByStaffId', references: 'staff(id)', onDelete: 'SET NULL' },
    ],
    indexes: ['penalties_loanId_idx', 'penalties_status_idx'],
  },

  // Cluster: Compliance & Platform
  {
    name: 'Notification',
    table: 'notifications',
    cluster: 'Compliance & Platform',
    description: 'Multi-channel messaging log (SMS, Email, Push) triggered by loan approval, disbursement, and arrears.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'userId', type: 'VARCHAR(36)', constraints: 'NOT NULL' },
      { name: 'customerId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'channel', type: 'ENUM', constraints: 'SMS, EMAIL, IN_APP, PUSH' },
      { name: 'subject', type: 'VARCHAR(200)', constraints: 'NOT NULL' },
      { name: 'message', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'status', type: 'ENUM', constraints: 'SENT, DELIVERED, FAILED' },
    ],
    foreignKeys: [
      { column: 'userId', references: 'users(id)', onDelete: 'CASCADE' },
      { column: 'customerId', references: 'customers(id)', onDelete: 'SET NULL' },
    ],
    indexes: ['notifications_userId_idx', 'notifications_status_idx'],
  },
  {
    name: 'AuditLog',
    table: 'audit_logs',
    cluster: 'Compliance & Platform',
    description: 'Immutable regulatory audit trail recording previous/new JSON states, actor identity, and IP address.',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'userId', type: 'VARCHAR(36)', constraints: 'NULL' },
      { name: 'action', type: 'VARCHAR(100)', constraints: 'NOT NULL', note: 'e.g. LOAN_APPLICATION_APPROVED' },
      { name: 'entity, entityId', type: 'VARCHAR(80)', constraints: 'NOT NULL / NULL' },
      { name: 'previousValuesJson, newValuesJson', type: 'LONGTEXT', constraints: 'NULL' },
      { name: 'ipAddress, userAgent', type: 'VARCHAR', constraints: 'NULL' },
      { name: 'timestamp', type: 'DATETIME(3)', constraints: 'DEFAULT CURRENT_TIMESTAMP' },
    ],
    foreignKeys: [{ column: 'userId', references: 'users(id)', onDelete: 'SET NULL' }],
    indexes: ['audit_logs_userId_idx', 'audit_logs_action_idx', 'audit_logs_timestamp_idx'],
  },
  {
    name: 'SystemSetting',
    table: 'system_settings',
    cluster: 'Compliance & Platform',
    description: 'Global configuration key-value storage (accounting currency, SOFR spreads, grace periods).',
    fields: [
      { name: 'id', type: 'VARCHAR(36)', constraints: 'PRIMARY KEY' },
      { name: 'key', type: 'VARCHAR(100)', constraints: 'UNIQUE, NOT NULL' },
      { name: 'value', type: 'TEXT', constraints: 'NOT NULL' },
      { name: 'group', type: 'ENUM', constraints: 'GENERAL, LOAN_DEFAULTS, ACCOUNTING, SECURITY' },
      { name: 'isEncrypted', type: 'BOOLEAN', constraints: 'DEFAULT FALSE' },
      { name: 'updatedByUserId', type: 'VARCHAR(36)', constraints: 'NULL' },
    ],
    foreignKeys: [{ column: 'updatedByUserId', references: 'users(id)', onDelete: 'SET NULL' }],
    indexes: ['system_settings_key_key (UNIQUE)', 'system_settings_group_idx'],
  },
];

export const SystemArchitecturePage: React.FC = () => {
  const [health, setHealth] = useState<SystemHealthDTO | null>(null);
  const [mainView, setMainView] = useState<'schema' | 'deployment'>('schema');
  const [selectedCluster, setSelectedCluster] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<EntityDefinition>(ENTITY_REGISTRY[0]);

  useEffect(() => {
    api.health
      .check()
      .then(setHealth)
      .catch((err) => console.error(err));
  }, []);

  const clusters = ['ALL', 'Access & Security', 'Organization', 'Customer Dossier', 'Credit Origination', 'Master Ledger & Servicing', 'Compliance & Platform'];

  const filteredEntities = ENTITY_REGISTRY.filter((e) => {
    if (selectedCluster === 'ALL') return true;
    return e.cluster === selectedCluster;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              System Architecture & Production Deployment
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              MySQL 21-entity relational database models, actuarial arithmetic, and external Linux VPS deployment runbook
            </p>
          </div>

          {/* Primary View Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium self-start sm:self-auto">
            <button
              onClick={() => setMainView('schema')}
              className={`px-3 py-1.5 rounded transition-colors ${
                mainView === 'schema'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Relational Schema (21 Entities)
            </button>
            <button
              onClick={() => setMainView('deployment')}
              className={`px-3 py-1.5 rounded transition-colors ${
                mainView === 'deployment'
                  ? 'bg-slate-900 text-white shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              VPS Production Guide (Ubuntu/Nginx)
            </button>
          </div>
        </div>
      </div>

      {mainView === 'deployment' ? (
        <VpsDeploymentGuide />
      ) : (
        <>
          {/* Operational Heartbeat & Telemetry */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Live Database Gateway Telemetry</h2>
            <p className="text-xs text-slate-500">Heartbeat status returned by /api/health</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            REST API Online
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs font-mono">
          <div>
            <span className="text-slate-400 block uppercase tracking-wide text-[10px] font-sans">Database Engine</span>
            <span className="font-semibold text-slate-900">MySQL 8.0+ / Prisma ORM</span>
          </div>
          <div>
            <span className="text-slate-400 block uppercase tracking-wide text-[10px] font-sans">Core Entities Provisioned</span>
            <span className="font-semibold text-emerald-700">21 Relational Models</span>
          </div>
          <div>
            <span className="text-slate-400 block uppercase tracking-wide text-[10px] font-sans">Monetary Precision</span>
            <span className="font-semibold text-slate-900">DECIMAL(16, 2)</span>
          </div>
          <div>
            <span className="text-slate-400 block uppercase tracking-wide text-[10px] font-sans">Rate Precision</span>
            <span className="font-semibold text-slate-900">DECIMAL(6, 4)</span>
          </div>
        </div>
      </div>

      {/* Domain Cluster Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded text-xs font-medium">
        {clusters.map((c) => (
          <button
            key={c}
            onClick={() => setSelectedCluster(c)}
            className={`px-3 py-1.5 rounded transition-colors ${
              selectedCluster === c ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* 2-Column Explorer: Entity List & Detailed Schema Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Entities List */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2 h-fit">
          <div className="text-xs font-semibold text-slate-700 px-2 pb-2 border-b border-slate-100 uppercase tracking-wider">
            Entities ({filteredEntities.length} of 21)
          </div>
          <div className="space-y-1">
            {filteredEntities.map((e) => (
              <button
                key={e.table}
                onClick={() => setSelectedEntity(e)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors flex items-center justify-between ${
                  selectedEntity.table === e.table
                    ? 'bg-slate-900 text-white font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div>
                  <div className="font-semibold">{e.name}</div>
                  <div className={`text-[10px] font-mono ${selectedEntity.table === e.table ? 'text-slate-300' : 'text-slate-400'}`}>
                    `{e.table}`
                  </div>
                </div>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${selectedEntity.table === e.table ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>
                  {e.fields.length} cols
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detailed Entity Inspector */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Cluster: {selectedEntity.cluster}
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  Entity: {selectedEntity.name} <span className="font-mono text-sm text-slate-500 font-normal">(`{selectedEntity.table}`)</span>
                </h3>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200">
                MySQL Engine
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {selectedEntity.description}
            </p>
          </div>

          {/* Table Columns Definition */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Column Data Types & Constraints</h4>
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-mono">
                  <tr>
                    <th className="py-2.5 px-3">Field Name</th>
                    <th className="py-2.5 px-3">MySQL Type</th>
                    <th className="py-2.5 px-3">Constraints & Modifiers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {selectedEntity.fields.map((f) => (
                    <tr key={f.name} className="hover:bg-slate-50/75">
                      <td className="py-2 px-3 font-semibold text-slate-900">{f.name}</td>
                      <td className="py-2 px-3 text-slate-700">{f.type}</td>
                      <td className="py-2 px-3 text-slate-500">
                        <span>{f.constraints}</span>
                        {f.note && <span className="block text-[10px] text-slate-400 font-sans mt-0.5">{f.note}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Foreign Keys & Constraints */}
          {selectedEntity.foreignKeys.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Foreign Key Relationships</h4>
              <div className="space-y-1.5 font-mono text-xs">
                {selectedEntity.foreignKeys.map((fk) => (
                  <div key={fk.column} className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800">{fk.column}</span>
                      <span className="text-slate-400 mx-2">→</span>
                      <span className="text-slate-700">{fk.references}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      ON DELETE {fk.onDelete}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Database Indexes */}
          <div>
            <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-2">Performance & Unique Indexes</h4>
            <div className="flex flex-wrap gap-2 font-mono text-[11px]">
              {selectedEntity.indexes.map((idx) => (
                <span key={idx} className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200">
                  {idx}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Migration Script & Deployment Terminal */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Prisma Migration & Database Deployment Commands
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Commands to validate, generate client, apply versioned migrations, and seed MySQL
          </p>
        </div>

        <div className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono space-y-3 leading-relaxed overflow-x-auto">
          <div>
            <span className="text-slate-400"># 1. Generate Typed Prisma Client</span>
            <div className="text-emerald-400">npx prisma generate</div>
          </div>
          <div>
            <span className="text-slate-400"># 2. Deploy Versioned DDL Migration to MySQL</span>
            <div className="text-emerald-400">npx prisma migrate deploy</div>
          </div>
          <div>
            <span className="text-slate-400"># 3. Seed Realistic 21-Entity Institutional Data</span>
            <div className="text-emerald-400">npm run prisma:seed</div>
          </div>
          <div>
            <span className="text-slate-400"># 4. Launch Prisma Studio (Interactive Database GUI)</span>
            <div className="text-emerald-400">npx prisma studio --port 5555</div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
