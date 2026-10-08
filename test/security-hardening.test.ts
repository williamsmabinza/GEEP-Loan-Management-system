import assert from 'assert';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword } from '../server/utils/password.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  hashToken,
} from '../server/utils/jwt.js';
import { config } from '../server/config/index.js';
import { getPermissionsForRole, roleHasPermission } from '../shared/constants/roles.js';
import { validateFileSecurity, sanitizeFilename, MAX_FILE_SIZE_BYTES } from '../server/utils/fileSecurity.js';
import { MemoryRateLimiter } from '../server/middleware/rateLimiter.js';
import { sanitizeSecurityLeaks } from '../server/middleware/errorHandler.js';
import { computePaymentAllocation } from '../server/services/payments.service.js';
import { LoanDTO } from '../shared/types/index.js';
import { CreateLoanApplicationSchema } from '../shared/validators/loan.js';
import { CreatePaymentSchema } from '../shared/validators/payment.js';

console.log('🛡️ Starting Nexa LMS Enterprise Security Hardening Test Suite...\n');

// ==============================================================================
// 1. Password Security & Hashing Tests
// ==============================================================================
console.log('--- Suite 1: Secure Password Hashing & Bcrypt Compliance ---');

async function testPasswordHashing() {
  const plain = 'NexaP@ssw0rd!2026';
  const hash = await hashPassword(plain);

  assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'Bcrypt hash must start with standard identifier');
  assert.strictEqual(await verifyPassword(plain, hash), true, 'Valid password verification must succeed');
  assert.strictEqual(await verifyPassword('WrongPassword123!', hash), false, 'Invalid password must be rejected');

  // Verify unique salts produce different hashes
  const hash2 = await hashPassword(plain);
  assert.notStrictEqual(hash, hash2, 'Salting must ensure two hashes of the same password are unique');
  console.log('  ✓ Password hashing uses secure salted bcrypt rounds');
}

// ==============================================================================
// 2. JWT Token Security & Tamper Resistance
// ==============================================================================
console.log('\n--- Suite 2: JWT Security & Token Tampering Safeguards ---');

function testJwtSecurity() {
  const payload = {
    userId: 'usr-sec-01',
    email: 'security.officer@nexa.financial',
    role: 'ADMIN' as const,
    firstName: 'Audit',
    lastName: 'Officer',
  };

  const token = generateAccessToken(payload);
  assert.ok(token && typeof token === 'string', 'JWT access token generated');

  const decoded = verifyAccessToken(token);
  assert.strictEqual(decoded.userId, payload.userId, 'Decoded user ID matches');
  assert.strictEqual(decoded.role, 'ADMIN', 'Decoded user role matches');
  assert.ok(Array.isArray(decoded.permissions), 'Token includes permissions array');

  // Verify tampered token is rejected
  const parts = token.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...payload, role: 'SUPER_ADMIN' })
  ).toString('base64url');
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

  assert.throws(
    () => {
      verifyAccessToken(tamperedToken);
    },
    /JsonWebTokenError|invalid signature/,
    'Tampered JWT signature must throw validation error'
  );

  // High entropy refresh token hashing
  const refresh = generateRefreshToken('usr-sec-01');
  assert.strictEqual(refresh.token.length, 80, '40-byte hex refresh token provides 80 chars high-entropy');
  assert.strictEqual(hashToken(refresh.token), refresh.hash, 'SHA-256 hash matches refresh token hash');

  console.log('  ✓ JWT signature tampering rejected and refresh tokens use SHA-256 high-entropy');
}

// ==============================================================================
// 3. Role-Based Access Control (RBAC) & Permission Matrix
// ==============================================================================
console.log('\n--- Suite 3: RBAC & Permission Matrix Integrity ---');

function testRbacPermissions() {
  // Verify Customer role cannot perform administrative operations
  assert.strictEqual(roleHasPermission('CUSTOMER', 'user.create'), false, 'Customer cannot create users');
  assert.strictEqual(roleHasPermission('CUSTOMER', 'loan.approve'), false, 'Customer cannot approve loans');
  assert.strictEqual(roleHasPermission('CUSTOMER', 'loan.disburse'), false, 'Customer cannot disburse loans');
  assert.strictEqual(roleHasPermission('CUSTOMER', 'settings.update'), false, 'Customer cannot modify settings');
  assert.strictEqual(roleHasPermission('CUSTOMER', 'payment.reverse'), false, 'Customer cannot reverse payments');

  // Verify Loan Officer cannot disburse or modify system settings
  assert.strictEqual(roleHasPermission('LOAN_OFFICER', 'loan.create'), true, 'Loan officer can create loan applications');
  assert.strictEqual(roleHasPermission('LOAN_OFFICER', 'loan.disburse'), false, 'Loan officer cannot disburse funds');
  assert.strictEqual(roleHasPermission('LOAN_OFFICER', 'settings.update'), false, 'Loan officer cannot alter core settings');

  // Verify Super Administrator has all permissions
  const superAdminPerms = getPermissionsForRole('SUPER_ADMIN');
  assert.ok(superAdminPerms.includes('loan.disburse'), 'Super Admin has disburse permission');
  assert.ok(superAdminPerms.includes('settings.update'), 'Super Admin has settings permission');
  assert.ok(superAdminPerms.includes('audit.view'), 'Super Admin has audit view permission');

  console.log('  ✓ Strict role segregation enforced across Customer, Officer, Manager, and Admin roles');
}

// ==============================================================================
// 4. Financial Calculations & Backend Source of Truth
// ==============================================================================
console.log('\n--- Suite 4: Financial Calculation Integrity & Anti-Tampering ---');

function testFinancialIntegrity() {
  const dummyLoan: LoanDTO = {
    id: 'ln-sec-01',
    loanNumber: 'LN-2026-0001',
    customerId: 'cust-sec-01',
    borrowerId: 'cust-sec-01',
    productId: 'prod-sme-01',
    principalAmount: 10_000_000,
    interestRate: 12.0,
    termMonths: 12,
    repaymentFrequency: 'MONTHLY',
    totalInterest: 1_200_000,
    totalPayable: 11_200_000,
    monthlyInstallment: 933_333,
    remainingBalance: 1_870_000,
    totalPaidAmount: 0,
    status: 'ACTIVE',
    purpose: 'Commercial Working Capital',
    applicationDate: '2026-01-01',
    maturityDate: '2027-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    repayments: [
      {
        id: 'sch-1',
        installmentNumber: 1,
        dueDate: '2026-02-01',
        principalDue: 800_000,
        interestDue: 100_000,
        feesDue: 20_000,
        penaltyDue: 50_000,
        totalDue: 970_000,
        principalPaid: 0,
        interestPaid: 0,
        feesPaid: 0,
        penaltyPaid: 0,
        totalPaid: 0,
        outstandingAmount: 970_000,
        status: 'SCHEDULED',
      },
      {
        id: 'sch-2',
        installmentNumber: 2,
        dueDate: '2026-03-01',
        principalDue: 800_000,
        interestDue: 100_000,
        feesDue: 0,
        penaltyDue: 0,
        totalDue: 900_000,
        principalPaid: 0,
        interestPaid: 0,
        feesPaid: 0,
        penaltyPaid: 0,
        totalPaid: 0,
        outstandingAmount: 900_000,
        status: 'SCHEDULED',
      },
    ],
  };

  // Compute allocation with pure server-side business logic
  const result = computePaymentAllocation(dummyLoan, 970_000, '2026-02-01');

  // Verify allocation strictly respects priority: Penalties -> Fees -> Interest -> Principal
  assert.strictEqual(result.totalPenaltiesAllocated, 50_000, 'Penalties allocated first');
  assert.strictEqual(result.totalFeesAllocated, 20_000, 'Fees allocated second');
  assert.strictEqual(result.totalInterestAllocated, 100_000, 'Interest allocated third');
  assert.strictEqual(result.totalPrincipalAllocated, 800_000, 'Principal allocated fourth');
  assert.strictEqual(result.totalAllocated, 970_000, 'Total allocated matches payment amount');

  // A malicious client cannot forge outstanding balance calculation
  assert.strictEqual(result.newTotalOutstandingBalance, 900_000, 'Backend recalculates new balance accurately');
  assert.strictEqual(result.loanStatus, 'ACTIVE', 'Loan remains active while future installments remain unpaid');

  console.log('  ✓ Payment allocations and loan balances calculated exclusively on backend');
}

// ==============================================================================
// 5. File Upload Security & Path Traversal Prevention
// ==============================================================================
console.log('\n--- Suite 5: File Upload Validation & Path Traversal Prevention ---');

function testFileUploadSecurity() {
  // Valid PDF
  const valid = validateFileSecurity({
    filename: 'Baraka_National_ID_Card.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 1024 * 2, // 2MB
  });
  assert.strictEqual(valid.isValid, true);
  assert.strictEqual(valid.sanitizedFilename, 'Baraka_National_ID_Card.pdf');

  // Path Traversal Attempt
  assert.throws(
    () => {
      validateFileSecurity({
        filename: '../../../etc/passwd.pdf',
        mimeType: 'application/pdf',
      });
    },
    /directory traversal|null byte/i,
    'Directory traversal in filename must be blocked'
  );

  // Dangerous Extension (.exe, .sh, .php)
  assert.throws(
    () => {
      validateFileSecurity({
        filename: 'malicious_payload.exe',
      });
    },
    /prohibited for security reasons/i,
    'Prohibited executable extensions must be rejected'
  );

  // Web script extension (.php)
  assert.throws(
    () => {
      validateFileSecurity({
        filename: 'backdoor.php',
      });
    },
    /prohibited for security reasons/i,
    'PHP script uploads must be rejected'
  );

  // Oversized File (> 10MB)
  assert.throws(
    () => {
      validateFileSecurity({
        filename: 'huge_document.pdf',
        sizeBytes: MAX_FILE_SIZE_BYTES + 1024,
      });
    },
    /exceeds maximum allowable limit of 10 MB/i,
    'Oversized file upload must be rejected'
  );

  // Sanitization neutralizing shell metacharacters
  const sanitized = sanitizeFilename('my document; rm -rf / && cat.pdf');
  assert.strictEqual(sanitized.includes(';'), false);
  assert.strictEqual(sanitized.includes(' '), false);

  console.log('  ✓ File type restrictions, size limits, and filename sanitization enforced');
}

// ==============================================================================
// 6. Rate Limiting Protection
// ==============================================================================
console.log('\n--- Suite 6: Rate Limiting & DoS Protection ---');

function testRateLimiting() {
  process.env.TEST_RATE_LIMIT = 'true';

  const limiter = new MemoryRateLimiter({
    windowMs: 60_000,
    maxRequests: 3,
    skip: () => false,
    keyGenerator: () => 'test-ip-127.0.0.1',
  });

  const mockReq = { headers: {}, socket: { remoteAddress: '127.0.0.1' }, path: '/test' } as any;

  let blocked = false;
  let statusCode = 200;

  const mockRes = {
    headers: {} as Record<string, any>,
    setHeader(key: string, val: any) {
      this.headers[key] = val;
    },
    status(code: number) {
      statusCode = code;
      return {
        json: (payload: any) => {
          if (code === 429) blocked = true;
        },
      };
    },
  } as any;

  // Requests 1, 2, 3 should succeed
  limiter.middleware()(mockReq, mockRes, () => {});
  assert.strictEqual(mockRes.headers['RateLimit-Remaining'], 2);

  limiter.middleware()(mockReq, mockRes, () => {});
  assert.strictEqual(mockRes.headers['RateLimit-Remaining'], 1);

  limiter.middleware()(mockReq, mockRes, () => {});
  assert.strictEqual(mockRes.headers['RateLimit-Remaining'], 0);

  // Request 4 must be rate-limited (HTTP 429)
  limiter.middleware()(mockReq, mockRes, () => {});
  assert.strictEqual(blocked, true, '4th request must trigger rate limit');
  assert.strictEqual(statusCode, 429, 'Rate limited response status code must be 429');

  delete process.env.TEST_RATE_LIMIT;
  console.log('  ✓ Sliding-window rate limiter returns 429 Too Many Requests when ceiling exceeded');
}

// ==============================================================================
// 7. Sensitive Credential Redaction & Leaks Protection
// ==============================================================================
console.log('\n--- Suite 7: Sensitive Credential Redaction in Errors & Logs ---');

function testCredentialRedaction() {
  const leakStr = 'Connection failed at mysql://nexa_admin:SecretPass123!@db.internal:3306/nexa_lms';
  const clean = sanitizeSecurityLeaks(leakStr);

  assert.strictEqual(clean.includes('SecretPass123!'), false, 'Database password must be redacted');
  assert.ok(clean.includes('[REDACTED_PASSWORD]'), 'Database password replaced with placeholder');

  const jwtLeak = 'Failed token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123signature';
  const cleanJwt = sanitizeSecurityLeaks(jwtLeak);
  assert.strictEqual(cleanJwt.includes('abc123signature'), false, 'JWT token must be redacted');
  assert.ok(cleanJwt.includes('[REDACTED_JWT]'), 'JWT replaced with placeholder');

  console.log('  ✓ Database credentials and JWT tokens cleanly redacted from error outputs');
}

// ==============================================================================
// 8. Input Validation & Injection Payload Handling
// ==============================================================================
console.log('\n--- Suite 8: Schema Validation & Malicious Payload Neutralization ---');

function testInputValidation() {
  // Reject negative principal amount
  assert.throws(() => {
    CreateLoanApplicationSchema.parse({
      productId: 'prod-sme-01',
      principalAmount: -500_000,
      termMonths: 12,
      purpose: 'Equipment purchase',
    });
  }, /greater than zero/i);

  // Reject excessively large principal amount
  assert.throws(() => {
    CreateLoanApplicationSchema.parse({
      productId: 'prod-sme-01',
      principalAmount: 99_000_000_000,
      termMonths: 12,
      purpose: 'Capital expansion',
    });
  }, /Exceeds maximum allowable loan ceiling/i);

  // Reject invalid payment amount
  assert.throws(() => {
    CreatePaymentSchema.parse({
      loanId: 'ln-01',
      amount: -100,
      paymentMethod: 'CASH',
      paymentDate: '2026-02-01',
    });
  }, /greater than zero/i);

  console.log('  ✓ Zod validation schemas strictly enforce boundary and type safety');
}

// ==============================================================================
// Runner
// ==============================================================================
async function runAllSecurityTests() {
  await testPasswordHashing();
  testJwtSecurity();
  testRbacPermissions();
  testFinancialIntegrity();
  testFileUploadSecurity();
  testRateLimiting();
  testCredentialRedaction();
  testInputValidation();

  console.log('\n🎉 All 8 Enterprise Security Hardening Test Suites Passed with 100% Success!');
}

runAllSecurityTests().catch((err) => {
  console.error('\n❌ Security test failed:', err);
  process.exit(1);
});
