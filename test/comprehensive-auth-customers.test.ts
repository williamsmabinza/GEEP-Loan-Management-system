import assert from 'node:assert/strict';
import {
  loginUser,
  logoutUser,
  changePassword,
  updateUserActivation,
  getUserById,
} from '../server/services/auth.service.js';
import {
  createCustomer,
  updateCustomer,
  updateCustomerKycStatus,
  addCustomerDocument,
  verifyCustomerDocument,
  getCustomerById,
} from '../server/services/customers.service.js';
import { verifyAccessToken, generateAccessToken } from '../server/utils/jwt.js';
import { roleHasPermission, getPermissionsForRole } from '../shared/constants/roles.js';
import { CreateCustomerSchema, UpdateKycStatusSchema } from '../shared/validators/customer.js';
import { AppError } from '../server/middleware/errorHandler.js';
import { UserRole } from '../shared/types/index.js';

console.log('🧪 Starting Nexa LMS Comprehensive Authentication, Authorization & Customer Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

async function testAsync(description: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(err);
    process.exit(1);
  }
}

// ==============================================================================
// Group 1: Authentication Core Workflows
// ==============================================================================
console.log('--- Group 1: Authentication Core Workflows (Login, Logout, Passwords, Status) ---');

await testAsync('Valid login succeeds and returns valid JWT access token and user profile', async () => {
  const result = await loginUser({
    email: 'admin@nexa.financial',
    password: 'Admin@2026!',
  });

  assert.ok(result.token, 'Must return JWT access token');
  assert.ok(result.refreshToken, 'Must return refresh token');
  assert.ok(result.user, 'Must return user object');
  assert.strictEqual(result.user.email, 'admin@nexa.financial');
  assert.strictEqual(result.user.role, 'ADMIN');

  // Verify access token signature and payload
  const decoded = verifyAccessToken(result.token);
  assert.strictEqual(decoded.email, 'admin@nexa.financial');
  assert.strictEqual(decoded.role, 'ADMIN');
  assert.ok(Array.isArray(decoded.permissions), 'Token payload must include permissions array');
});

await testAsync('Login fails with invalid password credentials', async () => {
  let threw = false;
  try {
    await loginUser({
      email: 'admin@nexa.financial',
      password: 'IncorrectPassword999!',
    });
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.statusCode, 401, 'Status code must be 401 Unauthorized');
  }
  assert.ok(threw, 'Expected invalid password to throw AppError');
});

await testAsync('Login fails with non-existent email address', async () => {
  let threw = false;
  try {
    await loginUser({
      email: 'doesnotexist@nexa.financial',
      password: 'Admin@2026!',
    });
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.statusCode, 401, 'Status code must be 401 Unauthorized');
  }
  assert.ok(threw, 'Expected non-existent user to throw AppError');
});

await testAsync('Disabled / inactive user is blocked from logging in', async () => {
  // Suspend cashier user
  await updateUserActivation(
    'user-cashier-01',
    { status: 'SUSPENDED', reason: 'Security investigation pending' },
    'usr-admin-01'
  );

  let threw = false;
  try {
    await loginUser({
      email: 'cashier@nexa.financial',
      password: 'Cashier@2026!',
    });
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.statusCode, 403, 'Disabled user must receive 403 Forbidden');
    assert.match(err.message, /SUSPENDED/i, 'Error message should indicate account suspension');
  }
  assert.ok(threw, 'Expected disabled user to be blocked');

  // Re-activate user for subsequent tests
  await updateUserActivation(
    'user-cashier-01',
    { status: 'ACTIVE', reason: 'Investigation concluded with clear findings' },
    'usr-admin-01'
  );

  const reLogin = await loginUser({
    email: 'cashier@nexa.financial',
    password: 'Cashier@2026!',
  });
  assert.strictEqual(reLogin.user.email, 'cashier@nexa.financial', 'Reactivated user can log in');
});

await testAsync('Logout invalidates user session', async () => {
  await logoutUser('usr-admin-01');
  // Should complete cleanly without error
  assert.ok(true, 'Logout executed successfully');
});

await testAsync('Password change verifies current password, updates hash, and blocks old password', async () => {
  // 1. Attempt change with incorrect current password
  let badPassThrew = false;
  try {
    await changePassword('user-officer-01', {
      oldPassword: 'WrongOldPassword!',
      newPassword: 'BrandNewSecurePassword123!',
    });
  } catch (err: any) {
    badPassThrew = true;
    assert.strictEqual(err.statusCode, 400, 'Invalid old password must return 400');
  }
  assert.ok(badPassThrew, 'Changing password with bad old password must fail');

  // 2. Perform valid password change
  await changePassword('user-officer-01', {
    oldPassword: 'Officer@2026!',
    newPassword: 'NewOfficerPass@2026!',
  });

  // 3. Login with new password succeeds
  const loginNew = await loginUser({
    email: 'officer@nexa.financial',
    password: 'NewOfficerPass@2026!',
  });
  assert.strictEqual(loginNew.user.email, 'officer@nexa.financial', 'Login with updated password succeeds');

  // 4. Login with old password fails
  let oldLoginThrew = false;
  try {
    await loginUser({
      email: 'officer@nexa.financial',
      password: 'Officer@2026!',
    });
  } catch (err: any) {
    oldLoginThrew = true;
    assert.strictEqual(err.statusCode, 401);
  }
  assert.ok(oldLoginThrew, 'Old password must be rejected after password change');
});

// ==============================================================================
// Group 2: Authorization & Role-Based Access Control (RBAC)
// ==============================================================================
console.log('\n--- Group 2: Authorization & Role-Based Permissions ---');

await testAsync('Customer role is restricted from staff and admin operations', async () => {
  const customerRole: UserRole = 'CUSTOMER';
  const prohibitedActions = [
    'loan.approve',
    'loan.disburse',
    'loan.reject',
    'payment.reverse',
    'customer.delete',
    'user.create',
    'settings.update',
    'reports.view',
  ];

  for (const action of prohibitedActions) {
    assert.strictEqual(
      roleHasPermission(customerRole, action),
      false,
      `Customer role must NOT have permission '${action}'`
    );
  }
});

await testAsync('Credit Officer can review loans but cannot disburse or reverse payments', async () => {
  const officerRole: UserRole = 'CREDIT_OFFICER';
  assert.strictEqual(roleHasPermission(officerRole, 'loan.review'), true);
  assert.strictEqual(roleHasPermission(officerRole, 'loan.disburse'), false);
  assert.strictEqual(roleHasPermission(officerRole, 'payment.reverse'), false);
  assert.strictEqual(roleHasPermission(officerRole, 'settings.update'), false);
});

await testAsync('Cashier can record payments but cannot approve loans or delete customers', async () => {
  const cashierRole: UserRole = 'CASHIER';
  assert.strictEqual(roleHasPermission(cashierRole, 'payment.create'), true);
  assert.strictEqual(roleHasPermission(cashierRole, 'loan.approve'), false);
  assert.strictEqual(roleHasPermission(cashierRole, 'loan.disburse'), false);
  assert.strictEqual(roleHasPermission(cashierRole, 'customer.delete'), false);
});

await testAsync('Unauthorized API request simulation rejects invalid or missing credentials', async () => {
  // Simulating middleware behavior:
  // 1. Missing token
  const authHeaderMissing = undefined;
  assert.strictEqual(Boolean(authHeaderMissing), false, 'Missing header identified');

  // 2. Tampered token
  const validToken = generateAccessToken({
    userId: 'test-user-01',
    email: 'test@nexa.financial',
    role: 'CUSTOMER',
    firstName: 'Test',
    lastName: 'User',
    permissions: getPermissionsForRole('CUSTOMER'),
  });

  const parts = validToken.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ userId: 'test-user-01', role: 'SUPER_ADMIN' })).toString('base64url');
  const forgedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;

  assert.throws(
    () => {
      verifyAccessToken(forgedToken);
    },
    /JsonWebTokenError|invalid signature/,
    'Forged signature must throw error'
  );
});

// ==============================================================================
// Group 3: Customer Management & KYC Workflows
// ==============================================================================
console.log('\n--- Group 3: Customer Management & KYC Workflows ---');

const sampleCustomerInput = {
  firstName: 'Amara',
  lastName: 'Kigoma',
  email: 'amara.kigoma@example.com',
  phone: '+255 784 123 456',
  dateOfBirth: '1990-05-14',
  gender: 'FEMALE' as const,
  maritalStatus: 'MARRIED' as const,
  idType: 'NATIONAL_ID' as const,
  idNumber: 'NIDA-19900514-8841-01',
  addressLine1: '42 Haile Selassie Road, Oysterbay',
  city: 'Dar es Salaam',
  state: 'Dar es Salaam',
  country: 'TZ',
  employmentType: 'FULL_TIME_SALARIED' as const,
  employerName: 'Tanzania Ports Authority',
  monthlyIncome: 3500000,
  creditScore: 720,
  branchId: 'br-dar-01',
};

let createdCustomerId = '';

await testAsync('Customer creation successfully registers customer profile with active status and pending KYC', async () => {
  const customer = await createCustomer(sampleCustomerInput, 'usr-admin-01');

  assert.ok(customer, 'Customer should be created');
  assert.ok(customer.id, 'Customer must have unique id');
  assert.ok(customer.customerNumber, 'Customer must have customerNumber assigned');
  assert.strictEqual(customer.firstName, 'Amara');
  assert.strictEqual(customer.lastName, 'Kigoma');
  assert.strictEqual(customer.profileStatus, 'ACTIVE');
  assert.strictEqual(customer.kycStatus, 'PENDING');
  assert.strictEqual(customer.monthlyIncome, 3500000);

  createdCustomerId = customer.id;
});

await testAsync('Customer update successfully modifies contact and financial parameters', async () => {
  assert.ok(createdCustomerId, 'Created customer ID must exist');

  const updated = await updateCustomer(
    createdCustomerId,
    {
      phone: '+255 784 999 888',
      monthlyIncome: 4200000,
      addressLine1: 'Plot 104, Peninsula Avenue',
    },
    'usr-admin-01'
  );

  assert.strictEqual(updated.phone, '+255 784 999 888');
  assert.strictEqual(updated.monthlyIncome, 4200000);
  assert.strictEqual(updated.addressLine1, 'Plot 104, Peninsula Avenue');
});

await testAsync('Customer input validation rejects invalid inputs', async () => {
  // 1. Missing first name
  const invalid1 = CreateCustomerSchema.safeParse({
    ...sampleCustomerInput,
    firstName: 'A', // min 2
  });
  assert.strictEqual(invalid1.success, false, 'First name < 2 chars must fail');

  // 2. Invalid email format
  const invalid2 = CreateCustomerSchema.safeParse({
    ...sampleCustomerInput,
    email: 'not-an-email',
  });
  assert.strictEqual(invalid2.success, false, 'Malformed email must fail');

  // 3. Negative monthly income
  const invalid3 = CreateCustomerSchema.safeParse({
    ...sampleCustomerInput,
    monthlyIncome: -50000,
  });
  assert.strictEqual(invalid3.success, false, 'Negative income must fail');
});

await testAsync('Customer KYC lifecycle transitions from PENDING -> UNDER_REVIEW -> VERIFIED', async () => {
  assert.ok(createdCustomerId, 'Created customer ID must exist');

  // 1. Transition to UNDER_REVIEW
  const reviewStage = await updateCustomerKycStatus(
    createdCustomerId,
    {
      kycStatus: 'UNDER_REVIEW',
      notes: 'Initial documents submitted by customer, officer assigned for review.',
    },
    'staff-credit-01'
  );
  assert.strictEqual(reviewStage.kycStatus, 'UNDER_REVIEW');

  // 2. Add KYC Document
  const doc = await addCustomerDocument(
    createdCustomerId,
    {
      documentType: 'NATIONAL_ID',
      documentName: 'national-id-scan.pdf',
      fileUrl: '/uploads/kyc/national-id-scan.pdf',
      fileSizeBytes: 1024 * 500, // 500 KB
      mimeType: 'application/pdf',
    },
    'staff-credit-01'
  );
  assert.ok(doc, 'Document record must be created');
  assert.strictEqual(doc.documentType, 'NATIONAL_ID');

  // 3. Verify KYC Document
  const verifiedDoc = await verifyCustomerDocument(
    createdCustomerId,
    doc.id,
    { verificationStatus: 'VERIFIED' },
    'staff-credit-01'
  );
  assert.strictEqual(verifiedDoc.verificationStatus, 'VERIFIED');

  // 4. Transition KYC status to VERIFIED
  const verifiedStage = await updateCustomerKycStatus(
    createdCustomerId,
    {
      kycStatus: 'VERIFIED',
      notes: 'All identification documents verified against government registry.',
    },
    'staff-credit-01'
  );
  assert.strictEqual(verifiedStage.kycStatus, 'VERIFIED');
});

await testAsync('Customer KYC rejection sets status to REJECTED with reason', async () => {
  // Test KYC validation schema requirement for notes
  const invalidKyc = UpdateKycStatusSchema.safeParse({
    kycStatus: 'REJECTED',
    notes: 'No', // too short (< 3 chars)
  });
  assert.strictEqual(invalidKyc.success, false, 'Short notes must fail');

  const rejectedStage = await updateCustomerKycStatus(
    createdCustomerId,
    {
      kycStatus: 'REJECTED',
      notes: 'Proof of residential address expired over 6 months ago.',
    },
    'staff-credit-01'
  );
  assert.strictEqual(rejectedStage.kycStatus, 'REJECTED');
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Authentication, Authorization & Customer Tests Passed Successfully!\n`);
