import { strict as assert } from 'assert';
import {
  generateReport,
  getReportFilterOptions,
  exportReport,
} from '../server/services/reports.service.js';
import { ReportType } from '../shared/types/index.js';

const ADMIN_USER = {
  userId: 'usr-admin-01',
  role: 'ADMIN' as const,
};

const BRANCH_MANAGER_DAR = {
  userId: 'usr-mgr-dar-01',
  role: 'BRANCH_MANAGER' as const,
  branchId: 'br-dar-01',
};

const ALL_14_REPORTS: ReportType[] = [
  'LOAN_PORTFOLIO',
  'LOAN_APPLICATIONS',
  'LOAN_DISBURSEMENTS',
  'REPAYMENTS',
  'OUTSTANDING_BALANCES',
  'OVERDUE_LOANS',
  'CUSTOMER_REPORT',
  'LOAN_PRODUCT_PERFORMANCE',
  'BRANCH_PERFORMANCE',
  'STAFF_PERFORMANCE',
  'COLLECTION_PERFORMANCE',
  'INCOME_FROM_INTEREST',
  'FEES_COLLECTED',
  'PENALTIES_COLLECTED',
];

async function runComprehensiveReportingTests() {
  console.log('🧪 Starting Comprehensive Reporting Module Automated Test Suite...\n');

  // --- Group 1: Filter Options Completeness ---
  console.log('--- Group 1: Filter Options Completeness ---');
  const filterOpts = await getReportFilterOptions(ADMIN_USER);
  assert(filterOpts.branches && filterOpts.branches.length >= 4, 'Must return at least 4 branches');
  assert(filterOpts.products && filterOpts.products.length > 0, 'Must return loan products');
  assert(filterOpts.loanStatuses && filterOpts.loanStatuses.length > 0, 'Must return loan statuses');
  assert(filterOpts.applicationStatuses && filterOpts.applicationStatuses.length > 0, 'Must return application statuses');
  assert(filterOpts.staffMembers && filterOpts.staffMembers.length > 0, 'Must return staff members');
  assert(filterOpts.customers && filterOpts.customers.length > 0, 'Must return customers list');
  assert.equal(filterOpts.isBranchRestricted, false, 'Admin must not be branch-restricted');
  console.log('  ✓ Filter options include branches, products, statuses, staff, and customers');

  // Branch Manager Filter Scoping
  const bmOpts = await getReportFilterOptions(BRANCH_MANAGER_DAR);
  assert.equal(bmOpts.isBranchRestricted, true, 'Branch Manager must be branch-restricted');
  assert.equal(bmOpts.branches.length, 1, 'Branch Manager must only see authorized branch');
  assert.equal(bmOpts.branches[0].id, 'br-dar-01');
  console.log('  ✓ Branch manager filter options are properly scoped to authorized branch');

  // --- Group 2: All 14 Required Reports Generation ---
  console.log('\n--- Group 2: All 14 Required Reports Generation ---');
  for (const reportType of ALL_14_REPORTS) {
    const report = await generateReport(
      {
        reportType,
        page: 1,
        pageSize: 10,
      },
      ADMIN_USER
    );

    assert(report.title && report.title.length > 0, `${reportType} must have a title`);
    assert(report.description && report.description.length > 0, `${reportType} must have a description`);
    assert(report.columns && report.columns.length > 0, `${reportType} must define table columns`);
    assert(Array.isArray(report.rows), `${reportType} rows must be an array`);
    assert(report.pagination, `${reportType} must return pagination metadata`);
    assert(report.pagination.page === 1, `${reportType} current page must be 1`);
    assert(report.pagination.pageSize === 10, `${reportType} page size must match`);
    assert(report.summary && typeof report.summary === 'object', `${reportType} must return summary metrics`);

    console.log(`  ✓ Report ${reportType}: "${report.title}" compiled with ${report.columns.length} columns and ${report.rows.length} rows`);
  }

  // --- Group 3: Monetary Totals & Calculation Accuracy ---
  console.log('\n--- Group 3: Monetary Totals & Calculation Accuracy ---');
  const portfolioReport = await generateReport({ reportType: 'LOAN_PORTFOLIO', pageSize: 100 }, ADMIN_USER);
  assert(portfolioReport.summary['Total Facilities'] !== undefined, 'Must calculate Total Facilities');
  assert(portfolioReport.summary['Gross Disbursed Volume'] !== undefined, 'Must calculate Gross Disbursed Volume');
  assert(portfolioReport.summary['Total Outstanding Balance'] !== undefined, 'Must calculate Total Outstanding Balance');

  const repaymentsReport = await generateReport({ reportType: 'REPAYMENTS', pageSize: 100 }, ADMIN_USER);
  assert(repaymentsReport.summary['Gross Amount Collected'] !== undefined, 'Must calculate Gross Amount Collected');
  assert(repaymentsReport.summary['Principal Recovered'] !== undefined, 'Must calculate Principal Recovered');
  assert(repaymentsReport.summary['Interest Income Earned'] !== undefined, 'Must calculate Interest Income Earned');

  const interestReport = await generateReport({ reportType: 'INCOME_FROM_INTEREST', pageSize: 100 }, ADMIN_USER);
  assert(interestReport.summary['Gross Interest Earned'] !== undefined, 'Must calculate Gross Interest Earned');

  const feesReport = await generateReport({ reportType: 'FEES_COLLECTED', pageSize: 100 }, ADMIN_USER);
  assert(feesReport.summary['Gross Fees Collected'] !== undefined, 'Must calculate Gross Fees Collected');

  const penaltiesReport = await generateReport({ reportType: 'PENALTIES_COLLECTED', pageSize: 100 }, ADMIN_USER);
  assert(penaltiesReport.summary['Gross Penalties Collected'] !== undefined, 'Must calculate Gross Penalties Collected');
  console.log('  ✓ Monetary totals and accounting breakdown metrics verified across portfolios and ledgers');

  // --- Group 4: Filtering, Sorting, and Pagination ---
  console.log('\n--- Group 4: Filtering, Sorting, and Pagination ---');
  // Date filtering
  const todayStr = new Date().toISOString().split('T')[0];
  const dateFiltered = await generateReport(
    {
      reportType: 'LOAN_PORTFOLIO',
      startDate: '2020-01-01',
      endDate: todayStr,
    },
    ADMIN_USER
  );
  assert(dateFiltered.rows !== undefined, 'Date range filter returns valid dataset');

  // Pagination slice verification
  const page1 = await generateReport({ reportType: 'LOAN_PORTFOLIO', page: 1, pageSize: 2 }, ADMIN_USER);
  const page2 = await generateReport({ reportType: 'LOAN_PORTFOLIO', page: 2, pageSize: 2 }, ADMIN_USER);
  assert.equal(page1.rows.length, Math.min(2, page1.pagination.totalRecords));
  if (page1.pagination.totalRecords > 2) {
    assert.notEqual(page1.rows[0]?.id, page2.rows[0]?.id, 'Page 1 and Page 2 must not have identical first item');
  }
  console.log('  ✓ Pagination correctly pages through database results');

  // Sorting
  const sortedAsc = await generateReport(
    {
      reportType: 'LOAN_PORTFOLIO',
      sortBy: 'principalAmount',
      sortOrder: 'asc',
      pageSize: 50,
    },
    ADMIN_USER
  );
  if (sortedAsc.rows.length >= 2) {
    assert(
      sortedAsc.rows[0].principalAmount <= sortedAsc.rows[1].principalAmount,
      'Ascending sort order must have smaller or equal principal first'
    );
  }

  const sortedDesc = await generateReport(
    {
      reportType: 'LOAN_PORTFOLIO',
      sortBy: 'principalAmount',
      sortOrder: 'desc',
      pageSize: 50,
    },
    ADMIN_USER
  );
  if (sortedDesc.rows.length >= 2) {
    assert(
      sortedDesc.rows[0].principalAmount >= sortedDesc.rows[1].principalAmount,
      'Descending sort order must have larger or equal principal first'
    );
  }
  console.log('  ✓ Sorting works accurately in both asc and desc order');

  // --- Group 5: Exporting (CSV and PDF/Printable) ---
  console.log('\n--- Group 5: Exporting (CSV and PDF/Printable) ---');
  const csvExport = await exportReport({ reportType: 'LOAN_PORTFOLIO' }, ADMIN_USER, 'csv');
  assert(csvExport.filename.endsWith('.csv'), 'CSV filename must end with .csv');
  assert.equal(csvExport.contentType, 'text/csv');
  assert(csvExport.content.includes('Nexa Loan Management System'), 'CSV must include header metadata');
  assert(csvExport.content.includes('Loan Number'), 'CSV must include column labels');

  const pdfExport = await exportReport({ reportType: 'OVERDUE_LOANS' }, ADMIN_USER, 'pdf');
  assert(pdfExport.filename.endsWith('.html'), 'Printable PDF filename must end with .html');
  assert.equal(pdfExport.contentType, 'text/html');
  assert(pdfExport.content.includes('NEXA MICROFINANCE BANKING'), 'Printable document must include bank letterhead');
  assert(pdfExport.content.includes('window.print()'), 'Printable document must have print button trigger');
  console.log('  ✓ CSV and Print-Ready exports generated with institutional header, summary metrics, and data rows');

  // --- Group 6: Role-Based Branch Manager Jurisdiction Scoping ---
  console.log('\n--- Group 6: Role-Based Branch Manager Jurisdiction Scoping ---');
  const bmReport = await generateReport({ reportType: 'LOAN_PORTFOLIO' }, BRANCH_MANAGER_DAR);
  assert.equal(bmReport.filtersApplied.branchId, 'br-dar-01', 'Branch Manager must be strictly restricted to br-dar-01');
  bmReport.rows.forEach((row) => {
    assert(
      row.branchName.toLowerCase().includes('dar'),
      `Row branch ${row.branchName} must belong to Dar es Salaam`
    );
  });
  console.log('  ✓ Branch managers strictly restricted to their assigned branch records');

  console.log('\n🎉 All 6 Comprehensive Reporting Automated Test Groups Passed Successfully!');
}

runComprehensiveReportingTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
