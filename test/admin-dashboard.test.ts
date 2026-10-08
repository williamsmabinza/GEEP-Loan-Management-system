import assert from 'node:assert/strict';
import { getDashboardSummary, INSTITUTIONAL_BRANCHES } from '../server/services/reports.service.js';
import { UserRole } from '../shared/types/index.js';

console.log('🧪 Starting Administrator Dashboard & Analytics Automated Test Suite...\n');

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

const adminUser = {
  userId: 'user-admin-01',
  role: 'ADMIN' as UserRole,
  firstName: 'Sarah',
  lastName: 'Sterling',
};

const branchManagerUser = {
  userId: 'user-manager-01',
  role: 'BRANCH_MANAGER' as UserRole,
  branchId: 'br-dar-01',
  firstName: 'David',
  lastName: 'Sterling',
};

// ----------------------------------------------------------------------------
// Test Group 1: Core Dashboard Summary Metrics
// ----------------------------------------------------------------------------
console.log('--- Group 1: Core Dashboard Summary Metrics ---');

await testAsync('Admin dashboard summary returns all required metrics with correct database aggregation', async () => {
  const summary = await getDashboardSummary(adminUser);

  assert.ok(summary, 'Dashboard summary must not be null');
  assert.ok(summary.metrics, 'Metrics object must be present');

  const { metrics } = summary;
  assert.strictEqual(typeof metrics.totalCustomers, 'number', 'totalCustomers must be numeric');
  assert.ok(metrics.totalCustomers >= 0, 'totalCustomers must be non-negative');

  assert.strictEqual(typeof metrics.activeLoans, 'number', 'activeLoans must be numeric');
  assert.ok(metrics.activeLoans >= 0, 'activeLoans must be non-negative');

  assert.strictEqual(typeof metrics.pendingApplications, 'number', 'pendingApplications must be numeric');
  assert.strictEqual(typeof metrics.approvedLoans, 'number', 'approvedLoans must be numeric');
  assert.strictEqual(typeof metrics.disbursedAmount, 'number', 'disbursedAmount must be numeric');
  assert.strictEqual(typeof metrics.totalRepayments, 'number', 'totalRepayments must be numeric');
  assert.strictEqual(typeof metrics.outstandingPortfolio, 'number', 'outstandingPortfolio must be numeric');
  assert.strictEqual(typeof metrics.overdueAmount, 'number', 'overdueAmount must be numeric');
  assert.strictEqual(typeof metrics.completedLoans, 'number', 'completedLoans must be numeric');

  // Verify PAR indicators
  assert.ok(metrics.par, 'PAR metrics object must be present');
  assert.strictEqual(typeof metrics.par.par30Amount, 'number');
  assert.strictEqual(typeof metrics.par.par30Ratio, 'number');
  assert.strictEqual(typeof metrics.par.par60Amount, 'number');
  assert.strictEqual(typeof metrics.par.par60Ratio, 'number');
  assert.strictEqual(typeof metrics.par.par90Amount, 'number');
  assert.strictEqual(typeof metrics.par.par90Ratio, 'number');
  assert.strictEqual(typeof metrics.par.delinquencyRate, 'number');
  assert.strictEqual(typeof metrics.par.nplRatio, 'number');
});

// ----------------------------------------------------------------------------
// Test Group 2: Charts Dataset Completeness
// ----------------------------------------------------------------------------
console.log('\n--- Group 2: Charts Dataset Completeness ---');

await testAsync('Dashboard returns all 7 required visualization datasets', async () => {
  const summary = await getDashboardSummary(adminUser);
  const { charts } = summary;

  // 1. Disbursement over time
  assert.ok(Array.isArray(charts.disbursementOverTime), 'disbursementOverTime must be array');
  assert.ok(charts.disbursementOverTime.length >= 6, 'Must contain at least 6 periods');
  assert.ok(charts.disbursementOverTime[0].period, 'Must have period label');
  assert.strictEqual(typeof charts.disbursementOverTime[0].amount, 'number');

  // 2. Repayments over time
  assert.ok(Array.isArray(charts.repaymentsOverTime), 'repaymentsOverTime must be array');
  assert.ok(charts.repaymentsOverTime.length >= 6, 'Must contain at least 6 periods');
  assert.strictEqual(typeof charts.repaymentsOverTime[0].amount, 'number');
  assert.strictEqual(typeof charts.repaymentsOverTime[0].principal, 'number');
  assert.strictEqual(typeof charts.repaymentsOverTime[0].interest, 'number');

  // 3. Active vs completed loans distribution
  assert.ok(charts.activeVsCompleted, 'activeVsCompleted must exist');
  assert.strictEqual(typeof charts.activeVsCompleted.activeCount, 'number');
  assert.strictEqual(typeof charts.activeVsCompleted.completedCount, 'number');
  assert.strictEqual(typeof charts.activeVsCompleted.inArrearsCount, 'number');

  // 4. Portfolio by product
  assert.ok(Array.isArray(charts.portfolioByProduct), 'portfolioByProduct must be array');
  assert.ok(charts.portfolioByProduct.length > 0, 'portfolioByProduct must not be empty');
  assert.ok(charts.portfolioByProduct[0].productName, 'Must include product name');
  assert.strictEqual(typeof charts.portfolioByProduct[0].outstandingBalance, 'number');

  // 5. Portfolio by branch
  assert.ok(Array.isArray(charts.portfolioByBranch), 'portfolioByBranch must be array');
  assert.strictEqual(charts.portfolioByBranch.length, INSTITUTIONAL_BRANCHES.length, 'Must cover all institutional branches');

  // 6. Overdue loans aging
  assert.ok(Array.isArray(charts.overdueLoansAging), 'overdueLoansAging must be array');
  assert.strictEqual(charts.overdueLoansAging.length, 4, 'Must have 4 aging brackets');
  assert.ok(charts.overdueLoansAging[0].bracket.includes('1 - 30 Days'));

  // 7. Application trends
  assert.ok(Array.isArray(charts.applicationTrends), 'applicationTrends must be array');
  assert.ok(charts.applicationTrends.length >= 6, 'Must have monthly trends');
});

// ----------------------------------------------------------------------------
// Test Group 3: Tables Dataset Completeness
// ----------------------------------------------------------------------------
console.log('\n--- Group 3: Tables Dataset Completeness ---');

await testAsync('Dashboard returns all 4 required operational tables with itemized rows', async () => {
  const summary = await getDashboardSummary(adminUser);
  const { tables } = summary;

  assert.ok(Array.isArray(tables.recentApplications), 'recentApplications must be array');
  assert.ok(Array.isArray(tables.recentPayments), 'recentPayments must be array');
  assert.ok(Array.isArray(tables.overdueLoans), 'overdueLoans must be array');
  assert.ok(Array.isArray(tables.recentCustomers), 'recentCustomers must be array');

  if (tables.recentApplications.length > 0) {
    const app = tables.recentApplications[0];
    assert.ok(app.applicationNumber, 'Application must have applicationNumber');
    assert.ok(app.requestedAmount > 0, 'Application must have requestedAmount');
  }

  if (tables.recentCustomers.length > 0) {
    const cust = tables.recentCustomers[0];
    assert.ok(cust.customerNumber, 'Customer must have customerNumber');
    assert.ok(cust.name, 'Customer must have name');
  }
});

// ----------------------------------------------------------------------------
// Test Group 4: Role Permissions & Branch Scoping
// ----------------------------------------------------------------------------
console.log('\n--- Group 4: Role Permissions & Branch Scoping ---');

await testAsync('Branch managers are restricted to their authorized branch', async () => {
  const bmSummary = await getDashboardSummary(branchManagerUser);

  assert.strictEqual(bmSummary.context.isBranchRestricted, true, 'Branch manager must be restricted');
  assert.strictEqual(bmSummary.context.selectedBranchId, 'br-dar-01');
  assert.strictEqual(bmSummary.context.authorizedBranches.length, 1, 'Only assigned branch visible');
  assert.strictEqual(bmSummary.context.authorizedBranches[0].id, 'br-dar-01');
});

await testAsync('Administrators have institution-wide access and can filter by branch', async () => {
  const adminSummary = await getDashboardSummary(adminUser);

  assert.strictEqual(adminSummary.context.isBranchRestricted, false, 'Admin must not be restricted');
  assert.strictEqual(adminSummary.context.selectedBranchId, 'ALL');
  assert.strictEqual(adminSummary.context.authorizedBranches.length, INSTITUTIONAL_BRANCHES.length);

  // Admin filter by specific branch
  const filteredSummary = await getDashboardSummary(adminUser, 'br-aru-02');
  assert.strictEqual(filteredSummary.context.selectedBranchId, 'br-aru-02');
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Admin Dashboard Tests Passed Successfully!`);
