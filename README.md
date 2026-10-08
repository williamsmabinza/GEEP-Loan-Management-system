# Nexa Loan Management System (LMS)

[![Architecture](https://img.shields.io/badge/Architecture-Full--Stack%20Monorepo-0F172A)](.)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20TypeScript-3178C6)](.)
[![Database](https://img.shields.io/badge/Database-MySQL%208.0%20%7C%20Prisma%20ORM-00758F)](.)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind%20CSS-06B6D4)](.)
[![Security](https://img.shields.io/badge/Security-JWT%20%7C%20Bcrypt%20%7C%20RBAC%20%7C%20Zod-10B981)](.)

**Nexa Loan Management System** is an enterprise-grade commercial and retail credit servicing platform engineered for high-volume banking and microfinance operations. The system features a production-ready **21-entity relational database architecture** running on **MySQL 8.0+** with **Prisma ORM**, strict referential integrity, exact monetary `DECIMAL(16, 2)` precision, comprehensive Role-Based Access Control (RBAC), and automated compliance audit trails.

---

## 1. Directory Structure

```
├── /prisma
│   ├── schema.prisma              # 21-entity production MySQL relational schema
│   ├── seed.ts                    # Realistic institutional seed script (roles, staff, customers, loans)
│   └── migrations/
│       └── 20261005000000_init_nexa_loan_management_system/
│           └── migration.sql      # Versioned DDL migration script (675 lines of pristine MySQL DDL)
│
├── /server                        # Node.js + Express + TypeScript Backend
│   ├── config/index.ts            # Centralized environment variable loader and validator
│   ├── controllers/
│   │   ├── auth.controller.ts     # Login, register, refresh, password reset, user management handlers
│   │   ├── customers.controller.ts# Customer directory, KYC onboarding, dossier handlers
│   │   ├── loans.controller.ts    # Loan origination, underwriting review, payment handlers
│   │   ├── payments.controller.ts # Cashier collection, payment settlement, accountant reversal handlers
│   │   ├── reports.controller.ts  # Portfolio surveillance & regulatory CSV export handlers
│   │   ├── settings.controller.ts # Global system parameters & risk limits handlers
│   │   ├── audit.controller.ts    # Compliance audit trail query handlers
│   │   └── health.controller.ts   # Operational health and MySQL latency telemetry
│   ├── db/
│   │   └── prisma.ts              # PrismaClient singleton, pool health checker, graceful disconnect
│   ├── middleware/
│   │   ├── auth.ts                # JWT extraction & Role-Based Access Control (RBAC) guards
│   │   ├── auditLogger.ts         # Asynchronous audit event recorder
│   │   ├── errorHandler.ts        # Global error interceptor (Zod, Prisma, JWT, AppError)
│   │   └── validate.ts            # Zod request payload validation middleware
│   ├── routes/
│   │   ├── auth.routes.ts         # /api/auth routes
│   │   ├── users.routes.ts        # /api/users routes (User administration & RBAC)
│   │   ├── customers.routes.ts    # /api/customers routes (Customer & KYC vault)
│   │   ├── loans.routes.ts        # /api/loans routes (Underwriting & servicing)
│   │   ├── payments.routes.ts     # /api/payments routes (Cashier & collection desk)
│   │   ├── products.routes.ts     # /api/products routes (Loan product catalog)
│   │   ├── reports.routes.ts      # /api/reports routes (Portfolio analytics & export)
│   │   ├── settings.routes.ts     # /api/settings routes (Global parameters)
│   │   ├── audit.routes.ts        # /api/audit-logs routes (Compliance audit log)
│   │   ├── health.routes.ts       # /api/health telemetry route
│   │   └── index.ts               # Root API aggregator router
│   ├── services/
│   │   ├── auth.service.ts        # Password hashing, token signing, session lifecycle, user management
│   │   ├── customers.service.ts   # Customer directory management & KYC profile lifecycle
│   │   ├── loans.service.ts       # Actuarial amortization math, EMI calculation, portfolio aggregates
│   │   ├── payments.service.ts    # Payment allocations and accountant reversal logic
│   │   ├── reports.service.ts     # Portfolio surveillance aggregates & CSV generation
│   │   ├── settings.service.ts    # System parameter persistence
│   │   └── audit.service.ts       # Immutable audit trail recording
│   └── utils/
│       ├── jwt.ts                 # JWT signing and verification utilities
│       ├── logger.ts              # Structured JSON/console logger with log levels
│       └── password.ts            # Bcrypt hashing with configurable salt rounds
│
├── /shared                        # Isomorphic contracts shared between Client and Server
│   ├── constants/roles.ts         # Institutional roles, permission matrix, authorization helpers
│   ├── types/index.ts             # Domain models, API envelopes, DTOs, Enums
│   └── validators/
│       ├── auth.ts                # Zod schemas for Login, Register, Password Change, User Admin
│       ├── customer.ts            # Zod schemas for Customer creation & updates
│       ├── loan.ts                # Zod schemas for Application, Underwriting Status, and Payments
│       ├── payment.ts             # Zod schemas for Payment collection & reversal
│       └── settings.ts            # Zod schemas for System settings updates
│
├── /src                           # React 19 + TypeScript + Tailwind CSS Frontend
│   ├── components/
│   │   ├── common/
│   │   │   ├── ChangePasswordModal.tsx # Authenticated user password change modal
│   │   │   ├── StatCard.tsx       # Enterprise metric card with tabular numerals
│   │   │   └── StatusIndicator.tsx# Anti-slop zero-pill semantic status component
│   │   └── layout/
│   │       ├── AppLayout.tsx      # Application layout with system connection telemetry
│   │       ├── Navbar.tsx         # Top Bar Contract compliant header with role switcher
│   │       └── ProtectedRoute.tsx # Route guard enforcing authentication and RBAC
│   ├── context/
│   │   └── AuthContext.tsx        # React context managing session, token, and user permissions
│   ├── pages/
│   │   ├── AdminDashboard.tsx     # Underwriting committee queue & portfolio surveillance
│   │   ├── CustomersPage.tsx      # Customer directory, KYC dossiers, borrower registration
│   │   ├── PaymentsPage.tsx       # Cashier counter desk, payment receipts, accounting reversals
│   │   ├── ReportsPage.tsx        # Executive portfolio reports, risk breakdown, CSV export
│   │   ├── UserManagementPage.tsx # User administration, account activation/suspension, RBAC matrix
│   │   ├── SettingsPage.tsx       # System parameters, credit policy, interest rate caps
│   │   ├── AuditLogsPage.tsx      # Compliance audit event explorer with JSON payload inspector
│   │   ├── CustomerDashboard.tsx  # Borrower portal: active facilities, amortization, payment modal
│   │   ├── LoanProductsPage.tsx   # Loan product catalog and terms
│   │   ├── LoginPage.tsx          # Institutional login, demo persona switcher, password reset
│   │   └── SystemArchitecturePage.tsx # Relational schema visualizer and VPS deploy guide
│   ├── services/
│   │   └── api.ts                 # Typed HTTP client with automatic Bearer token injection
│   ├── App.tsx                    # Root application component and role-aware navigation
│   └── main.tsx                   # React DOM entry point
│
├── .env.example                   # Template for environment configuration
├── server.ts                      # Full-stack entry point (Express + Vite middleware in dev, static in prod)
└── package.json                   # Dependency definitions and scripts
```

---

## 2. Complete 21-Entity Database Schema Architecture

The database architecture is structured into 6 interconnected domain clusters:

```
[Access & Security]
Role ◄───(M:N via RolePermission)───► Permission
  │
  ▼ (1:N)
User ────────┬─────────────────────────┐
             │                         │
             ▼ (1:1)                   ▼ (1:1)
           Staff                    Customer ◄────────────┐
             │                         │                   │
             │ (N:1)                   │ (N:1)             │
             ▼                         ▼                   │
           Branch ◄────────────────────┘                   │
             │                                             │
             ├─────────────────────────┐                   │
             ▼ (1:N)                   ▼ (1:N)             │
      LoanApplication ───────────────► Loan                │
             │                           │                 │
             ├─ Collateral (1:N)         ├─ Collateral     │
             ├─ LoanGuarantor (1:N)      ├─ LoanGuarantor ─┘
             ├─ CustomerDocument (1:N)   ├─ CustomerDocument
             │                           ├─ LoanDisbursement (1:N)
             │                           ├─ RepaymentSchedule (1:N) ◄───┐
             │                           ├─ Penalty (1:N)               │
             │                           │                              │
[Origination]                            ▼ (1:N)                        │
LoanProduct ◄─── InterestRate (1:N)    Payment ──► PaymentAllocation ───┘
```

### Entity Registry & Responsibilities

| # | Entity Name | Database Table | Primary Purpose & Relationships |
| :--- | :--- | :--- | :--- |
| 1 | **User** | `users` | Core authentication identity, password hash, status flags, and session audit tracking. Linked 1:1 to `Staff` or `Customer`. |
| 2 | **Role** | `roles` | RBAC roles: `SUPER_ADMIN`, `ADMIN`, `BRANCH_MANAGER`, `LOAN_OFFICER`, `CREDIT_OFFICER`, `UNDERWRITER`, `CASHIER`, `ACCOUNTANT`, `COLLECTION_OFFICER`, `CUSTOMER`. |
| 3 | **Permission** | `permissions` | Granular privileges (`loan:approve`, `repayment:collect`, `penalty:waive`, `customer:kyc_verify`). |
| - | **RolePermission** | `role_permissions` | Junction table joining `roles` and `permissions` with cascading delete. |
| 4 | **Customer** | `customers` | Borrower profile: identity cards, residential address, employment income, credit score, profile status, and KYC status. |
| 5 | **Staff** | `staff` | Internal employees (officers, underwriters, cashiers) assigned to physical `Branch` locations. |
| 6 | **Branch** | `branches` | Physical operating units with unique codes (`BR-HQ-001`, `BR-PAC-002`), city, state, country, and contact channels. |
| 7 | **LoanProduct** | `loan_products` | Lending facilities with min/max amounts, term ranges, base interest rates, fee formulas, penalty rates, and grace periods. |
| 8 | **InterestRate** | `interest_rates` | Dynamic interest rate tiers per product based on loan volume, duration, and credit score tiers. |
| 9 | **LoanApplication** | `loan_applications` | Origination pipeline, requested amounts, stated purpose, appraisal notes, loan officer and credit officer assignments, and committee approval/rejection stamps. |
| 10 | **Loan** | `loans` | Master financial ledger tracking principal, accrued interest, fees, penalties, outstanding balance, and repayment lifecycle. |
| 11 | **LoanGuarantor** | `loan_guarantors` | Third-party or customer guarantors legally bound to loan obligations with guaranteed amounts and employer details. |
| 12 | **Collateral** | `collaterals` | Tangible assets (real estate deeds, vehicles, industrial machinery, inventory) securing credit facilities with verified valuations. |
| 13 | **LoanDisbursement** | `loan_disbursements` | Capital release transactions via Fedwire, ACH, or Mobile Money with payment method, destination account, and authorization staff. |
| 14 | **RepaymentSchedule** | `repayment_schedules` | Exact installment ledger breaking down principal portion, interest portion, fees, penalties, total due, and payment status. |
| 15 | **Payment** | `payments` | Inbound borrower payment receipts (Cash, Bank Transfer, Mobile Money) with unique receipt numbers and transaction references. |
| 16 | **PaymentAllocation** | `payment_allocations` | Multi-component allocation splitting receipts across principal, interest, fees, and penalties. |
| 17 | **Penalty** | `penalties` | Late payment charges, default penalties, and administrative fee waivers with audit reasons. |
| 18 | **CustomerDocument** | `customer_documents` | Document vault archiving identity cards, payslips, tax filings, and collateral title deeds with verification status. |
| 19 | **Notification** | `notifications` | Multi-channel communication log (SMS, Email, In-App, Push) triggered by loan approval, disbursement, and arrears. |
| 20 | **AuditLog** | `audit_logs` | Immutable regulatory audit trail capturing actor identity, action type, entity ID, previous/new JSON states, and IP address. |
| 21 | **SystemSetting** | `system_settings` | Global platform key-value configurations (accounting base currency, SOFR spreads, grace periods). |

---

## 3. Financial Integrity & Monetary Data Types

Floating point types (`FLOAT`, `DOUBLE`, `REAL`) are strictly banned from financial columns to prevent cumulative rounding discrepancies.

All monetary values use MySQL `DECIMAL`:
- **Currency Columns**: `DECIMAL(16, 2)` (up to \$99,999,999,999,999.99 with exact cent precision):
  - `loans.principalAmount`
  - `loans.totalOutstandingBalance`
  - `loans.totalAmountExpected`
  - `loans.monthlyInstallment`
  - `repayment_schedules.principalDue`
  - `repayment_schedules.interestDue`
  - `repayment_schedules.totalDue`
  - `payments.amount`
  - `payment_allocations.principalAllocated`
  - `collaterals.valuationAmount`
- **Interest Rates & Percentage Columns**: `DECIMAL(6, 4)`:
  - `loan_products.defaultInterestRate` (e.g., `0.0875` represents 8.7500%)
  - `interest_rates.rate`
  - `loans.interestRate`
  - `loan_products.penaltyRate`

---

## 4. Authentication & Authorization Architecture

### A. Authentication Core
- **Password Hashing**: Passwords are never stored in plaintext. Passwords are hashed using bcrypt with salt rounds configurable via `BCRYPT_SALT_ROUNDS` (default `10`).
- **JWT Access Tokens**: Stateless JSON Web Tokens containing userId, email, role, and granted permissions signed using HMAC-SHA256 (`JWT_SECRET`). Default expiration is 8 hours (`JWT_EXPIRES_IN`).
- **Refresh Token Strategy**: Long-lived cryptographic refresh tokens stored hashed in the database (`refreshTokenHash`). When an access token expires, the client calls `POST /api/auth/refresh` to obtain a new access token without requiring re-login.
- **Account Lockout & Brute-Force Defense**: Failed login attempts increment `loginAttempts`. After 5 consecutive failures, the account is locked for 15 minutes (`lockedUntil`).
- **Password Change**: Authenticated users can change their password at `POST /api/auth/change-password`. All existing active refresh tokens are revoked upon password change.
- **Password Reset Architecture**: `POST /api/auth/forgot-password` generates a cryptographically signed one-time reset token valid for 1 hour (`passwordResetExpiresAt`). `POST /api/auth/reset-password` verifies the token, updates the password hash, and clears lockout status.
- **Account Lifecycle Activation**: Administrative personnel can activate, suspend, lock, or deactivate accounts via `PATCH /api/users/:id/status`, recording an audit reason and revoking active sessions.

### B. Role-Based Access Control (RBAC) & Granular Permissions
The application strictly enforces authorization on the backend via reusable Express middleware:
- `requireAuth`: Verifies the Bearer JWT token and attaches `req.user`.
- `requireRole(allowedRoles)`: Verifies role membership.
- `requirePermission(permissionCode)`: Verifies specific granular permission.
- `requireAnyPermission([permissionCodes])`: Verifies that the actor has at least one of the listed privileges.
- `Super Administrator` (`SUPER_ADMIN`) bypasses checks and holds universal access.

#### Granular Permissions Matrix:
- **CUSTOMERS**: `customer.view`, `customer.create`, `customer.update`, `customer.delete`
- **LOANS**: `loan.view`, `loan.create`, `loan.update`, `loan.approve`, `loan.reject`, `loan.disburse`, `loan.close`
- **PAYMENTS**: `payment.view`, `payment.create`, `payment.reverse`
- **REPORTS**: `report.view`, `report.export`
- **USERS**: `user.view`, `user.create`, `user.update`, `user.disable`
- **SETTINGS**: `settings.view`, `settings.update`
- **AUDIT**: `audit.view`

---

## 5. Customer Management Module

The Customer Management module provides end-to-end administration of commercial and retail borrowers with real-time MySQL/Prisma persistence, RBAC authorization, and compliance audit logging:

### A. Core Features
- **Customer Directory**: Tabular registry with live search across name, customer number, email, phone, and national ID/SSN.
- **Multi-Filter & Pagination**: Filter by KYC verification status (`VERIFIED`, `UNDER_REVIEW`, `PENDING`, `REJECTED`, `EXPIRED`) and Profile status (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `BLACKLISTED`) with configurable page sizing (5, 10, 20, 50).
- **Comprehensive Customer Profile (Dossier)**:
  - Customer number & registration timestamp.
  - Personal demographic identity (Full name, DOB, gender, marital status, photograph).
  - Sovereign identification (National ID, Passport, Driver's License, Tax ID).
  - Residential & business physical addresses.
  - Employment & business capacity (Monthly income, annualized run-rate, employer, job title, credit bureau score).
  - Next of kin / Emergency contact verification.
  - Assigned operational branch and status badges.
- **Financial Account Summary**:
  - Live calculations for Total Loans, Active Loans, Completed Loans.
  - Total Borrowed, Total Repaid, Outstanding Balance, and Overdue Balance.
  - Repayment progress bar and debt-to-income (DTI) appraisal.
- **Loan & Repayment Histories**:
  - Direct ledger linking to all customer loan accounts, amortization schedules, and cashier receipts.
- **Compliance Document Vault (Document Management)**:
  - Supports Sovereign ID, Passports, Business Registration Licenses, Bank Statements, Proof of Address, Tax Returns, and Collateral Deeds.
  - Add new document with file type, size, and secure storage URL.
  - Verify or reject documents with mandatory compliance notes.
  - Delete documents with audit logging.
- **Lifecycle & KYC Controls**:
  - KYC Status updater with compliance appraisal notes.
  - Account activation/deactivation/suspension with mandatory audit reasons.

### B. Customer REST API Endpoints
| HTTP Method | Route | Permission Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/customers` | `customer.view` | Paginated and filtered customer directory |
| `GET` | `/api/customers/:id` | `customer.view` | Full customer dossier including financial summary & documents |
| `POST` | `/api/customers` | `customer.create` | Onboard new retail or commercial credit customer |
| `PUT` | `/api/customers/:id` | `customer.update` | Update existing customer demographic & financial fields |
| `DELETE` | `/api/customers/:id` | `customer.delete` | Delete customer (checks for active loan facilities) |
| `PATCH` | `/api/customers/:id/status` | `customer.update` | Activate, suspend, or blacklist customer profile |
| `PATCH` | `/api/customers/:id/kyc` | `customer.update` | Update KYC status (`VERIFIED`, `UNDER_REVIEW`, `REJECTED`) |
| `POST` | `/api/customers/:id/documents` | `customer.update` | Upload/attach new compliance document to vault |
| `PATCH` | `/api/customers/:id/documents/:docId/verify` | `customer.update` | Verify or reject customer document with reason |
| `DELETE` | `/api/customers/:id/documents/:docId` | `customer.delete` | Remove document from customer compliance vault |

---

## 6. Loan Products & Decimal-Safe Financial Calculator Module

### A. Loan Product Administration
Administrative personnel can create, edit, activate, and deactivate loan products with full parameters:
- **Product Code & Name**: Sovereign and commercial identifiers (e.g. `PROD_SME_WORKING_CAPITAL`).
- **Principal Limits**: Configurable minimum and maximum borrowing limits (`minAmount`, `maxAmount`).
- **Tenor Limits**: Minimum and maximum loan term in months (`minTermMonths`, `maxTermMonths`).
- **Interest Rate & Formulas**: Configurable base interest rate (% APR) and actuarial calculation method:
  - `REDUCING_BALANCE_EQUAL_INSTALLMENTS` (Standard French Amortization)
  - `REDUCING_BALANCE_EQUAL_PRINCIPAL` (Equal Principal Amortization with declining total payments)
  - `FLAT_RATE` (Constant interest accrued on initial principal)
  - `SIMPLE_INTEREST` (Linear interest accrual)
  - `COMPOUND_INTEREST` (Periodic compound accumulation)
- **Repayment Frequencies**: Supported intervals include `DAILY` (365/yr), `WEEKLY` (52/yr), `BI_WEEKLY` (26/yr), `MONTHLY` (12/yr), `QUARTERLY` (4/yr), `SEMI_ANNUALLY` (2/yr), `ANNUALLY` (1/yr), and `BULLET_AT_MATURITY`.
- **Fee Structures**: Configurable processing fees and credit insurance fees as either `% of principal` or `fixed dollar amounts`.
- **Grace Periods & Penalties**: Operational grace periods (days), principal moratoriums (months), penalty rate (%/mo), and trigger classifications (`LATE_PAYMENT`, `DEFAULT`, `DISHONOURED_PAYMENT`, `COVENANT_BREACH`).
- **Lifecycle Statuses**: `ACTIVE`, `INACTIVE`, and `SUSPENDED` with automated compliance audit logging.

### B. Decimal-Safe Financial Calculator Architecture
The backend calculator (`server/services/loan-calculator.service.ts`) uses arbitrary-precision arithmetic (`decimal.js` with 28-digit precision and `ROUND_HALF_UP`) to prevent IEEE-754 floating-point rounding errors and fractional penny drift:
- **Zero-drift Amortization**: Sum of scheduled principal repayments equals the exact initial principal, with remaining debt balance reaching exactly `$0.00` on the final installment.
- **Computed Outputs**:
  - `principal`: Initial funded capital
  - `totalInterest`: Sum of interest across all amortization intervals
  - `processingFee`: Origination fee
  - `insuranceFee`: Credit insurance fee
  - `totalFees`: Total upfront and financed fees
  - `totalPayable`: Exact total liability (Principal + Interest + Fees)
  - `installmentAmount`: Periodic payment requirement
  - `numberOfInstallments`: Calculated payment periods
  - `apr`: Effective annualized percentage rate
  - `schedule`: Complete amortization table with installment index, calendar-accurate due dates, principal portion, interest portion, installment sum, and outstanding debt balance.
- **Reusability**:
  - **Loan Applications**: Generates exact loan records and schedule entities during origination.
  - **Admin Users**: Interactive test simulator in the Loan Products module.
  - **Borrower Portal**: Embedded customer loan simulator with 1-click application pre-fill.
  - **Repayment Schedule Generation**: Backend ledger generation.

### C. Loan Products & Calculator REST API Endpoints
| HTTP Method | Route | Permission Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Public / Auth | List available institutional credit products |
| `GET` | `/api/products/:id` | Public / Auth | Get product specifications and rate tiers |
| `POST` | `/api/products/calculate` | Public / Auth | Decimal-safe amortization simulation and schedule generation |
| `POST` | `/api/products` | `settings.update` | Create and publish a new credit product |
| `PUT` | `/api/products/:id` | `settings.update` | Update loan product parameters, bounds, and fee schedules |
| `PATCH` | `/api/products/:id/status`| `settings.update` | Toggle product activation status (`ACTIVE`, `INACTIVE`, `SUSPENDED`) |
| `DELETE` | `/api/products/:id` | `settings.update` | Delete loan product (checks for active loan facilities) |

### D. Automated Unit Testing
Run the financial arithmetic test suite verifying decimal safety across all calculation methods and frequencies:
```bash
npm test
# Executes tsx test/loan-calculator.test.ts (12/12 passing tests)
```

---

## 7. Pre-configured Role Identities (Development & Testing)

| Role Code | Institutional Email | Default Password | Primary Operational Responsibilities |
| :--- | :--- | :--- | :--- |
| **SUPER_ADMIN** | `superadmin@nexa.financial` | `SuperAdmin@2026!` | Universal system infrastructure, security policies, role definitions |
| **ADMIN** | `admin@nexa.financial` | `Admin@2026!` | User administration, audit trail inspection, credit committee approval |
| **BRANCH_MANAGER** | `manager@nexa.financial` | `Manager@2026!` | Branch operational oversight, loan approval, customer escalations |
| **LOAN_OFFICER** | `officer@nexa.financial` | `Officer@2026!` | Loan origination, applicant vetting, payment collection, KYC inspection |
| **CREDIT_OFFICER** | `credit@nexa.financial` | `Credit@2026!` | Credit appraisal, financial debt-to-income analysis, underwriting |
| **UNDERWRITER** | `underwriter@nexa.financial` | `Underwriter@2026!` | Institutional credit risk underwriting, covenants, committee approvals |
| **CASHIER** | `cashier@nexa.financial` | `Cashier@2026!` | Counter teller payments, cash collection, voucher receipts |
| **ACCOUNTANT** | `accountant@nexa.financial` | `Accountant@2026!` | Financial ledger balancing, payment reversals, accounting adjustments |
| **COLLECTION_OFFICER** | `collector@nexa.financial` | `Collector@2026!` | Delinquent recovery, arrears tracking, collateral realizations |
| **CUSTOMER** | `customer@nexa.financial` | `Customer@2026!` | Borrower facility portal, loan applications, amortization schedule, payments |

*(Note: Any demo account also accepts `Password123!` in local development mode).*

---

## 8. Environment Configuration (`.env`)

```ini
# Application Port & Mode
PORT=3000
NODE_ENV=production
APP_URL=https://lms.yourbank.com

# MySQL 8.0 Connection String (Use strong generated credentials and SSL)
DATABASE_URL="mysql://nexa_admin:GENERATE_STRONG_DATABASE_PASSWORD@localhost:3306/nexa_lms?sslaccept=strict"
DB_HOST=localhost
DB_PORT=3306
DB_USER=nexa_admin
DB_PASSWORD="GENERATE_STRONG_DATABASE_PASSWORD"
DB_NAME=nexa_lms

# Security & JWT Tokens (Must be high-entropy 32+ character secrets in production)
JWT_SECRET="GENERATE_HIGH_ENTROPY_JWT_SECRET_KEY_MIN_32_CHARACTERS"
JWT_EXPIRES_IN="8h"
JWT_REFRESH_SECRET="GENERATE_HIGH_ENTROPY_REFRESH_SECRET_KEY"
JWT_REFRESH_EXPIRES_IN="7d"
BCRYPT_SALT_ROUNDS=12

# Logging & Auditing
LOG_LEVEL=info
AUDIT_LOG_ENABLED=true

# Allowed CORS Origins (Comma-separated in production)
CORS_ORIGIN=https://lms.yourbank.com
```

---

## 9. Production VPS / Server Deployment

```bash
# 1. Install MySQL 8.0 & Node.js 22 LTS on Ubuntu Server
sudo apt update && sudo apt install -y mysql-server nodejs npm

# 2. Configure Database & User
sudo mysql -e "CREATE DATABASE nexa_lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'nexa_admin'@'localhost' IDENTIFIED BY 'StrongPassword2026!';"
sudo mysql -e "GRANT ALL PRIVILEGES ON nexa_lms.* TO 'nexa_admin'@'localhost'; FLUSH PRIVILEGES;"

# 3. Apply Prisma Migrations & Seed
npx prisma migrate deploy
npm run prisma:seed

# 4. Build Frontend & Launch Express Server via PM2
npm run build
sudo npm install -g pm2
pm2 start server.ts --name "nexa-lms" --interpreter tsx
pm2 save && pm2 startup
```

---

## 10. Production Security Requirements & Hardening Architecture

The Nexa Loan Management System implements comprehensive defense-in-depth security engineered for banking and financial services compliance:

### 10.1. Authentication & Session Security
- **Bcrypt Password Hashing**: Passwords hashed with configurable salt rounds (12 recommended for production). Salting ensures resistance against rainbow tables.
- **JWT Architecture**: Access tokens signed with high-entropy cryptographic keys and verified with strict issuer checks (`nexa-lms-auth`).
- **High-Entropy Refresh Tokens**: Refresh tokens generated using 40-byte cryptographically secure random bytes (`crypto.randomBytes`) and stored in the database as SHA-256 hashes.
- **Session Revocation**: Refresh tokens can be explicitly revoked upon logout or password modification.

### 10.2. Role-Based Access Control (RBAC) & Anti-Privilege Escalation
- **Strict Role Separation**: 9 distinct personas (Super Admin, Admin, Branch Manager, Loan Officer, Credit Analyst, Underwriter, Cashier/Teller, Customer, Auditor).
- **Granular Permissions Matrix**: Every sensitive endpoint is guarded by `requirePermission(...)` or `requireAnyPermission(...)`.
- **Anti-Privilege Escalation**: Non-superadministrators are prevented from assigning or modifying the `SUPER_ADMIN` role or modifying superadmin accounts.

### 10.3. Financial Integrity & Tamper-Resistant Calculations
- **Backend as Source of Truth**: Clients can never manipulate or inject loan balances, interest rates, repayment amounts, schedule allocations, or payment histories.
- **Actuarial Allocation Engine**: Payments are allocated on the server using deterministic financial rules (Penalties → Fees → Interest → Principal).
- **Double-Entry Ledger Integrity**: Payments and disbursements are recorded as immutable financial transactions. Reversals create offsetting contra-entries with mandatory audit justification.
- **Workflow State Machine**: Status transitions (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` → `ACTIVE` → `CLOSED`) require authorized signatures and cannot be bypassed.

### 10.4. Insecure Direct Object Reference (IDOR) Protections
- **Customer Scoping**: Customer users are strictly restricted to querying and mutating their own loans, applications, KYC dossiers, payment histories, and notification feeds.
- **Branch Jurisdiction Scoping**: Branch Managers are constrained to records belonging to their assigned institutional branch.
- **Composite Query Scoping**: Mutations such as notification dismissals and document deletions enforce composite database filters matching both resource ID and caller's identity.

### 10.5. File Upload Security & Malware Defense
- **MIME & Extension Whitelist**: Only authenticated banking documents (PDF, PNG, JPG/JPEG, WEBP, DOC/DOCX, XLS/XLSX, CSV) are permitted.
- **Prohibited Executables**: Strict blocking of dangerous extensions (`.exe`, `.sh`, `.php`, `.bat`, `.cmd`, `.bin`, `.js`, `.py`, `.svg`, etc.).
- **Size Enforcements**: Strict 10 MB ceiling enforced on all document uploads.
- **Path Traversal Neutralization**: Filenames are sanitized via `sanitizeFilename()` to strip path traversal sequences (`../`, `..\`), null bytes (`\0`), and shell characters.

### 10.6. Injection & XSS Defenses
- **SQL Injection Immunity**: 100% of relational queries utilize Prisma ORM parameterized statements and typed models.
- **XSS Protections**: React automatically escapes frontend DOM interpolations; printable HTML and report exports utilize `escapeHtml()` to neutralize malicious payloads.
- **Input Validation**: All API request bodies are parsed and validated using strict Zod schemas before reaching business logic.

### 10.7. Enterprise HTTP Security Headers & Network Controls
- **Content Security Policy (CSP)**: Strict resource loading policies preventing unauthorized external script execution.
- **Security Headers**: Enforces `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
- **HSTS**: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` enabled in production environments.
- **Server Masking**: `x-powered-by` header removed to prevent server technology fingerprinting.
- **CORS & Origin Verification**: Strict origin validation with explicit HTTP methods and headers; cross-site origin verification on state-mutating requests.

### 10.8. Rate Limiting & Denial-of-Service (DoS) Mitigation
- **Sliding-Window Rate Limiting**: Built-in in-memory rate limiting with automated token bucket cleanup.
- **Endpoint-Specific Ceilings**:
  - `/api/auth/*` (Login, Register, Password Reset): Max 15 attempts / 15 mins to mitigate brute-force attacks.
  - `/api/payments`, `/api/loans/:id/disburse`: Max 60 transactions / 5 mins to prevent race conditions.
  - Global API: Max 500 requests / 15 mins per IP.
- **Standard Telemetry**: Returns RFC-compliant `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, and `Retry-After` headers with HTTP 429 status.

### 10.9. Secret Redaction & Production Error Handling
- **Zero Sensitive Data Exposure**: Frontend DTOs never contain password hashes, refresh token hashes, database credentials, or secret keys.
- **Automated Redaction Engine**: Error handling middleware runs regex sanitization to strip database connection strings, JWT tokens, and password fields from all logs and responses.
- **Suppressed Stack Traces**: Production environment (`NODE_ENV=production`) suppresses internal error stack traces and internal database messages.

### 10.10. Immutable Audit Logging
- Every sensitive action (authentication, loan application submission, credit recommendation, underwriting approval, fund disbursement, cashier collection, accountant reversal, report export, document upload) records an immutable audit trail capturing actor, timestamp, client IP, user agent, and contextual payload metadata.

### 10.11. Automated Security & Comprehensive Test Suites

Run the full automated test suite containing 92 test cases across 9 dedicated test suites:
```bash
npm test
```

Or execute individual test suites directly:
```bash
npx tsx test/loan-calculator.test.ts              # Financial arithmetic, amortization & fee calculations
npx tsx test/approval-and-disbursement.test.ts    # Loan approval, credit committee decisioning & disbursement
npx tsx test/repayment-management.test.ts          # Payment allocation, multi-installment servicing & receipts
npx tsx test/admin-dashboard.test.ts              # Executive dashboard aggregates & jurisdiction scoping
npx tsx test/comprehensive-reporting.test.ts      # 14 institutional regulatory reports & export formats
npx tsx test/security-hardening.test.ts           # Enterprise security, token tamper resistance & sanitization
npx tsx test/comprehensive-auth-customers.test.ts # Authentication (login/logout/passwords), RBAC & KYC workflows
npx tsx test/comprehensive-loans-finance.test.ts  # End-to-end loan lifecycle, schedules & actuarial calculations
npx tsx test/comprehensive-security-db.test.ts    # IDOR, injection defense, file security, rate limiting & DB integrity
```

---

## 11. Automated Test Suites & Quality Verification Matrix

| Category | Test Suite | Capabilities Verified |
| :--- | :--- | :--- |
| **Authentication** | `comprehensive-auth-customers.test.ts` | Valid login, logout session invalidation, bad credentials rejection, account suspension/lockout enforcement, password changes with old password verification |
| **Authorization & RBAC** | `comprehensive-auth-customers.test.ts` | Customer boundary restrictions, Loan Officer review powers, Cashier payment collection boundaries, unauthorized request rejections |
| **Customers & KYC** | `comprehensive-auth-customers.test.ts` | Customer creation with unique customer numbers, dossier updates, Zod input validation, KYC lifecycle (`PENDING` → `UNDER_REVIEW` → `VERIFIED`/`REJECTED`), document verification |
| **Loan Lifecycle** | `comprehensive-loans-finance.test.ts` | Application origination, submission, credit assessment, committee approval, disbursement activation, scheduled repayments, terminal rejection enforcement, full loan payoff (`CLOSED_PAID_OFF`) |
| **Financial Arithmetic** | `loan-calculator.test.ts` & `comprehensive-loans-finance.test.ts` | Flat interest, French amortization reducing balance, installment calculations (Weekly, Bi-Weekly, Monthly, Quarterly), fee calculations (percentage and fixed), penalty accruals, zero precision drift |
| **Payment Servicing** | `repayment-management.test.ts` | Statutory allocation priority (Penalties → Fees → Interest → Principal), partial payments, overpayments, immutable reversal contra-entries, regulatory payment receipts |
| **Security & IDOR** | `comprehensive-security-db.test.ts` | IDOR prevention on loans, applications, profiles, and receipts; SQL injection parameterization; XSS entity escaping; malicious file upload blocking; sliding window rate limiting |
| **Database Integrity** | `comprehensive-security-db.test.ts` | Referential foreign key integrity, transaction rollback atomicity, duplicate reference prevention (unique national IDs, duplicate payment references) |
| **Reporting & Analytics** | `comprehensive-reporting.test.ts` & `admin-dashboard.test.ts` | Portfolio aggregates, 14 regulatory reports, CSV and HTML export generation, branch manager jurisdiction isolation |

---

## 12. External VPS Production Deployment Guide

This guide provides end-to-end instructions for deploying the **Nexa Loan Management System** on a dedicated or virtual Linux server (Ubuntu 22.04 LTS or 24.04 LTS) completely independent of Google AI Studio.

### System Architecture Overview

```
                      [ Internet / End Users ]
                                 │
                                 ▼
                     [ Port 80 / Port 443 ]
                                 │
                 ┌───────────────┴───────────────┐
                 │       Nginx Web Server        │
                 │  - Let's Encrypt SSL/TLS 1.3  │
                 │  - HTTP to HTTPS 301 Redirect │
                 │  - Security Headers & Gzip    │
                 │  - Rate Limiting Zones        │
                 └───────────────┬───────────────┘
                                 │
       ┌─────────────────────────┴─────────────────────────┐
       ▼                                                   ▼
[ Static Assets & SPA ]                           [ Reverse Proxy /api ]
/var/www/nexa-lms/dist                                 http://127.0.0.1:3000
                                                           │
                                                           ▼
                                              ┌─────────────────────────┐
                                              │   PM2 Process Manager   │
                                              │   (Cluster Mode: 2-4x)  │
                                              │    Node.js / Express    │
                                              └────────────┬────────────┘
                                                           │
                                                           ▼
                                              ┌─────────────────────────┐
                                              │    MySQL 8.0 Server     │
                                              │  - utf8mb4 charset      │
                                              │  - Strict SQL mode      │
                                              │  - InnoDB ACID Engine   │
                                              └─────────────────────────┘
```

---

### Step 1: Server Preparation

1. **Connect to your server via SSH:**
   ```bash
   ssh root@YOUR_SERVER_IP
   ```

2. **Update system packages and install essential utilities:**
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   sudo apt-get install -y curl wget git build-essential ufw certbot python3-certbot-nginx logrotate htop unzip
   ```

3. **Configure UFW Firewall:**
   ```bash
   sudo ufw default deny incoming
   sudo ufw default allow outgoing
   sudo ufw allow OpenSSH
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   # Never expose port 3306 externally; keep MySQL internal to 127.0.0.1
   sudo ufw --force enable
   sudo ufw status verbose
   ```

4. **Install Node.js 20 LTS via NodeSource:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   node -v  # Expected: v20.x or higher
   npm -v   # Expected: v10.x or higher
   ```

5. **Install PM2 globally:**
   ```bash
   sudo npm install -g pm2
   ```

---

### Step 2: MySQL Installation & Hardening

1. **Install MySQL 8.0 Server:**
   ```bash
   sudo apt-get install -y mysql-server
   sudo systemctl enable mysql
   sudo systemctl start mysql
   ```

2. **Run MySQL Security Script:**
   ```bash
   sudo mysql_secure_installation
   ```
   - Set root password validation to strong.
   - Remove anonymous users: **Yes**.
   - Disallow root login remotely: **Yes**.
   - Remove test database: **Yes**.
   - Reload privilege tables: **Yes**.

3. **Verify MySQL is bound strictly to `127.0.0.1`:**
   Check `/etc/mysql/mysql.conf.d/mysqld.cnf`:
   ```ini
   bind-address = 127.0.0.1
   mysqlx-bind-address = 127.0.0.1
   character-set-server = utf8mb4
   collation-server = utf8mb4_unicode_ci
   default-time-zone = '+00:00'
   ```
   Restart if modified:
   ```bash
   sudo systemctl restart mysql
   ```

---

### Step 3: Database & User Creation

1. **Log in to MySQL as root:**
   ```bash
   sudo mysql -u root
   ```

2. **Execute the provisioning queries:**
   *(Replace `'YourStrongProductionPassword123!'` with a randomly generated secret)*:
   ```sql
   -- Create institutional database with utf8mb4
   CREATE DATABASE nexa_lms
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;

   -- Create dedicated database application user
   CREATE USER 'nexa_admin'@'localhost' IDENTIFIED BY 'YourStrongProductionPassword123!';
   CREATE USER 'nexa_admin'@'127.0.0.1' IDENTIFIED BY 'YourStrongProductionPassword123!';

   -- Grant permissions on nexa_lms database only
   GRANT ALL PRIVILEGES ON nexa_lms.* TO 'nexa_admin'@'localhost';
   GRANT ALL PRIVILEGES ON nexa_lms.* TO 'nexa_admin'@'127.0.0.1';

   FLUSH PRIVILEGES;
   EXIT;
   ```

3. **Test local connection:**
   ```bash
   mysql -u nexa_admin -p -h 127.0.0.1 nexa_lms -e "STATUS;"
   ```

---

### Step 4: Application Deployment & Directory Structure

1. **Create application and logging directories:**
   ```bash
   sudo mkdir -p /var/www/nexa-lms
   sudo mkdir -p /var/log/nexa-lms
   sudo mkdir -p /var/backups/nexa-lms
   sudo mkdir -p /var/www/certbot
   ```

2. **Clone the repository:**
   ```bash
   cd /var/www/nexa-lms
   git clone <YOUR_GIT_REPOSITORY_URL> .
   ```

3. **Configure directory ownership and permissions:**
   ```bash
   # Create a dedicated system user or assign to www-data
   sudo chown -R www-data:www-data /var/www/nexa-lms
   sudo chown -R www-data:www-data /var/log/nexa-lms
   sudo chmod 700 /var/backups/nexa-lms
   sudo chmod 755 /var/log/nexa-lms
   sudo chmod +x deploy/scripts/*.sh
   ```

---

### Step 5: Environment Variables Configuration

1. **Copy the production environment template:**
   ```bash
   cd /var/www/nexa-lms
   cp .env.production.example .env
   chmod 600 .env
   ```

2. **Generate high-entropy cryptographic secrets:**
   ```bash
   # Generate JWT Secret:
   openssl rand -hex 32

   # Generate Refresh Secret:
   openssl rand -hex 32

   # Generate strong database password:
   openssl rand -base64 24
   ```

3. **Populate `/var/www/nexa-lms/.env`:**
   ```env
   NODE_ENV=production
   PORT=3000

   # Public Domain URLs
   APP_URL=https://lms.yourdomain.com
   CLIENT_URL=https://lms.yourdomain.com
   API_URL=https://lms.yourdomain.com/api
   CORS_ORIGIN=https://lms.yourdomain.com

   # Relational MySQL Connection
   DATABASE_URL="mysql://nexa_admin:YourStrongProductionPassword123!@127.0.0.1:3306/nexa_lms?connection_limit=20&pool_timeout=30"
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=nexa_admin
   DB_PASSWORD="YourStrongProductionPassword123!"
   DB_NAME=nexa_lms

   # Cryptographic Keys (Paste your generated 64-char strings)
   JWT_SECRET="YOUR_GENERATED_OPENSSL_HEX_32_SECRET"
   JWT_EXPIRES_IN="8h"
   JWT_REFRESH_SECRET="YOUR_GENERATED_OPENSSL_HEX_32_REFRESH_SECRET"
   JWT_REFRESH_EXPIRES_IN="7d"

   # Security & Logging
   BCRYPT_SALT_ROUNDS=12
   LOG_LEVEL=info
   AUDIT_LOG_ENABLED=true
   LOG_FILE_PATH=/var/log/nexa-lms/app.log
   ```

---

### Step 6: Prisma Database Migration

1. **Install application dependencies:**
   ```bash
   cd /var/www/nexa-lms
   npm install
   ```

2. **Generate Prisma Client models:**
   ```bash
   npx prisma generate
   ```

3. **Deploy database migrations:**
   *(Applies all 21 relational tables, indexes, constraints, and initial schema non-interactively)*:
   ```bash
   npx prisma migrate deploy
   ```

4. **(Optional) Seed initial institutional roles and branches:**
   ```bash
   npm run prisma:seed
   ```

---

### Step 7: Frontend Build

Compile and bundle the production React 19 Single Page Application (SPA) using Vite and Tailwind CSS:

```bash
cd /var/www/nexa-lms
npm run build:client
```

This compiles optimized, minified static HTML, CSS, JavaScript, and chunked assets directly into `/var/www/nexa-lms/dist`.

---

### Step 8: Backend Build

Compile and bundle the Node.js / Express / TypeScript backend entry point into a standalone ECMAScript module:

```bash
npm run build:server
```

*(Alternatively, run `npm run build` to execute both the frontend client and backend server build steps sequentially).*

Verify that the distribution directory contains both client assets and server bundle:
```bash
ls -lh dist/
# Expected:
# index.html
# assets/index-*.js
# assets/index-*.css
# server.js
```

---

### Step 9: PM2 Process Management Setup

1. **Start the application cluster using the production ecosystem file:**
   ```bash
   pm2 start deploy/pm2/ecosystem.config.cjs --env production
   ```

2. **Verify running processes:**
   ```bash
   pm2 status
   # Expected: status 'online', CPU/memory normal
   ```

3. **View live logs:**
   ```bash
   pm2 logs nexa-lms --lines 30
   ```

4. **Configure PM2 to start automatically on system reboot:**
   ```bash
   pm2 startup systemd -u root --hp /root
   pm2 save
   ```

---

### Step 10: Nginx Reverse Proxy Configuration

1. **Copy the pre-configured Nginx virtual host:**
   ```bash
   sudo cp deploy/nginx/nexa-lms.conf /etc/nginx/sites-available/nexa-lms.conf
   ```

2. **Update your domain name in `/etc/nginx/sites-available/nexa-lms.conf`:**
   Replace all instances of `lms.yourdomain.com` with your real domain name:
   ```bash
   sudo sed -i 's/lms.yourdomain.com/YOUR_DOMAIN.com/g' /etc/nginx/sites-available/nexa-lms.conf
   ```

3. **Enable the site configuration:**
   ```bash
   sudo ln -sf /etc/nginx/sites-available/nexa-lms.conf /etc/nginx/sites-enabled/nexa-lms.conf
   sudo rm -f /etc/nginx/sites-enabled/default
   ```

4. **Test Nginx syntax:**
   ```bash
   sudo nginx -t
   ```

---

### Step 11: SSL/TLS Certificate with Let's Encrypt

1. **Obtain automated SSL certificates via Certbot:**
   ```bash
   sudo certbot --nginx -d YOUR_DOMAIN.com
   ```
   - Provide your administrative email for expiry notifications.
   - Agree to terms of service.
   - Certbot will automatically detect `/etc/nginx/sites-available/nexa-lms.conf`, bind the certificates, and configure auto-renewal.

2. **Reload Nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

3. **Verify automated SSL renewal timer:**
   ```bash
   sudo certbot renew --dry-run
   sudo systemctl status certbot.timer
   ```

---

### Step 12: Automated Database Backups & Log Rotation

1. **Set up automated daily backups via Cron:**
   Edit the root crontab:
   ```bash
   sudo crontab -e
   ```
   Add the following line to run backups daily at 02:00 AM:
   ```cron
   0 2 * * * /var/www/nexa-lms/deploy/scripts/backup-db.sh >> /var/log/nexa-lms/backup.log 2>&1
   ```

2. **Test manual backup execution:**
   ```bash
   sudo bash /var/www/nexa-lms/deploy/scripts/backup-db.sh
   ls -lh /var/backups/nexa-lms/
   ```

3. **Configure logrotate for system logs:**
   ```bash
   sudo cp /var/www/nexa-lms/deploy/logrotate/nexa-lms /etc/logrotate.d/nexa-lms
   sudo chmod 644 /etc/logrotate.d/nexa-lms
   sudo logrotate -d /etc/logrotate.d/nexa-lms
   ```

---

### Step 13: Updating the Application (Zero-Downtime)

To deploy application updates without interrupting active users:

```bash
cd /var/www/nexa-lms
sudo bash deploy/scripts/deploy-update.sh
```

The script automatically:
1. Pulls the latest commits from `main`.
2. Installs updated dependencies.
3. Generates Prisma client.
4. Executes non-interactive database migrations (`prisma migrate deploy`).
5. Rebuilds frontend and backend bundles.
6. Executes a zero-downtime rolling reload across PM2 cluster workers.
7. Executes a health check verification probe against `/api/health`.

---

### Step 14: Disaster Recovery & Rollback Strategy

If a faulty release or database corruption occurs:

#### Application Rollback (Code Level):
```bash
cd /var/www/nexa-lms

# 1. Revert to previous Git commit or tag
git checkout <PREVIOUS_STABLE_COMMIT_HASH>

# 2. Re-install and re-compile
npm install
npm run build

# 3. Reload PM2 cluster
pm2 reload deploy/pm2/ecosystem.config.cjs --env production --update-env
```

#### Database Restoration (Data Level):
```bash
# 1. Identify the desired backup snapshot
ls -lh /var/backups/nexa-lms/

# 2. Run the interactive restoration script
sudo bash /var/www/nexa-lms/deploy/scripts/restore-db.sh /var/backups/nexa-lms/nexa_lms_backup_YYYYMMDD_HHMMSS.sql.gz

# 3. Restart application processes to refresh connection pools
pm2 restart nexa-lms
```

---

### Operational Verification Commands

| Action | Command |
| :--- | :--- |
| **Check API Health** | `curl -i http://127.0.0.1:3000/api/health` |
| **Monitor PM2 Cluster** | `pm2 monit` |
| **View Live Process Logs** | `pm2 logs nexa-lms` |
| **View Nginx Access Logs** | `sudo tail -f /var/log/nginx/nexa-lms.access.log` |
| **View Nginx Error Logs** | `sudo tail -f /var/log/nginx/nexa-lms.error.log` |
| **View Application Logs** | `sudo tail -f /var/log/nexa-lms/app.log` |
| **Test MySQL Connectivity** | `mysql -u nexa_admin -p -h 127.0.0.1 nexa_lms -e "SELECT count(*) FROM User;"` |



