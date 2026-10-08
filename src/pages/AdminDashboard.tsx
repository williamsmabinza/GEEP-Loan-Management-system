import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import {
  DashboardSummaryDTO,
  LoanApplicationDTO,
  PaymentTransactionDTO,
  PaymentReceiptDTO,
  DashboardOverdueLoanItem,
  LoanDTO,
} from '../../shared/types/index.js';
import { StatCard } from '../components/common/StatCard.js';
import { StatusIndicator } from '../components/common/StatusIndicator.js';
import { formatTZS } from '../utils/currency.js';
import { ApplicationReviewModal } from '../components/loan/ApplicationReviewModal.js';
import { PaymentReceiptModal } from '../components/payment/PaymentReceiptModal.js';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal.js';
import {
  ChartCard,
  DisbursementAndRepaymentsChart,
  DisbursementOverTimeChart,
  RepaymentsOverTimeChart,
  ActiveVsCompletedChart,
  ProductPortfolioChart,
  BranchPortfolioChart,
  OverdueLoansAgingChart,
  ApplicationTrendsChart,
} from '../components/dashboard/DashboardCharts.js';
import { ApplicationDetailsModal } from '../components/loan/ApplicationDetailsModal.js';
import { CustomerDossierModal } from '../components/customer/CustomerDossierModal.js';
import { useAuth } from '../context/AuthContext.js';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardSummaryDTO | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Chart Visual Perspective View Mode
  const [chartViewMode, setChartViewMode] = useState<'ALL' | 'FLOW' | 'PORTFOLIO' | 'RISK'>('ALL');

  // Table Tabs, Search, & Pagination
  const [activeTableTab, setActiveTableTab] = useState<'applications' | 'payments' | 'overdue' | 'customers'>(
    'applications'
  );
  const [tableSearch, setTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Modals
  const [reviewApplication, setReviewApplication] = useState<LoanApplicationDTO | null>(null);
  const [viewAppDetails, setViewAppDetails] = useState<LoanApplicationDTO | null>(null);
  const [viewReceipt, setViewReceipt] = useState<PaymentReceiptDTO | null>(null);
  const [viewCustomerId, setViewCustomerId] = useState<string | null>(null);
  const [recordPaymentLoanId, setRecordPaymentLoanId] = useState<string | null>(null);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);

  const fetchDashboard = async (branchId = selectedBranch) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.reports.getDashboard(branchId);
      setDashboardData(data);
      if (data.context.isBranchRestricted) {
        setSelectedBranch(data.context.selectedBranchId);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to load administrator dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard(selectedBranch);
  }, [selectedBranch]);

  const handleBranchChange = (newBranchId: string) => {
    setSelectedBranch(newBranchId);
    fetchDashboard(newBranchId);
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.reports.export('loans');
      const blob = new Blob([res.csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccessMsg('Portfolio ledger report exported successfully.');
    } catch (err) {
      setError((err as Error).message || 'Failed to export report');
    }
  };

  const handleOpenReceipt = async (paymentId: string) => {
    try {
      const receipt = await api.payments.getReceipt(paymentId);
      setViewReceipt(receipt);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch receipt');
    }
  };

  const isBranchManager = dashboardData?.context.isBranchRestricted || user?.role === 'BRANCH_MANAGER';

  // Filter table rows based on active search input
  const filteredApplications = (dashboardData?.tables.recentApplications || []).filter((app) => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return (
      app.applicationNumber.toLowerCase().includes(q) ||
      (app.customer && `${app.customer.firstName} ${app.customer.lastName}`.toLowerCase().includes(q)) ||
      (app.loanProduct?.name || '').toLowerCase().includes(q) ||
      app.status.toLowerCase().includes(q)
    );
  });

  const filteredPayments = (dashboardData?.tables.recentPayments || []).filter((p) => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return (
      (p.receiptNumber || '').toLowerCase().includes(q) ||
      (p.paymentReference || '').toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q) ||
      (p.loanNumber || '').toLowerCase().includes(q) ||
      p.method.toLowerCase().includes(q)
    );
  });

  const filteredOverdueLoans = (dashboardData?.tables.overdueLoans || []).filter((l) => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return (
      l.loanNumber.toLowerCase().includes(q) ||
      l.customerName.toLowerCase().includes(q) ||
      l.productName.toLowerCase().includes(q)
    );
  });

  const filteredCustomers = (dashboardData?.tables.recentCustomers || []).filter((c) => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return (
      c.customerNumber.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const currentItems =
    activeTableTab === 'applications'
      ? filteredApplications
      : activeTableTab === 'payments'
      ? filteredPayments
      : activeTableTab === 'overdue'
      ? filteredOverdueLoans
      : filteredCustomers;

  const totalPages = Math.max(1, Math.ceil(currentItems.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedApplications = filteredApplications.slice(startIndex, startIndex + pageSize);
  const paginatedPayments = filteredPayments.slice(startIndex, startIndex + pageSize);
  const paginatedOverdueLoans = filteredOverdueLoans.slice(startIndex, startIndex + pageSize);
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-8">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Zone with Branch Selector & Actions */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Administrator Executive Dashboard & Portfolio Surveillance
            </h1>
            <span className="text-xs text-slate-500 font-mono font-medium">
              · TZS (Tanzanian Shillings)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time institutional liquidity, credit risk monitoring, originations pipeline, and branch performance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Scoping Control */}
          {isBranchManager ? (
            <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <span>🏢</span>
              <span>
                {dashboardData?.context.authorizedBranches[0]?.name || 'Assigned Branch Jurisdiction'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono font-normal">
                (Manager Jurisdiction)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <label htmlFor="branch-select" className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Branch Scope:
              </label>
              <select
                id="branch-select"
                value={selectedBranch}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="ALL">All Branches (Institution-Wide)</option>
                {dashboardData?.context.authorizedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchDashboard(selectedBranch)}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1"
          >
            <span>↻</span> Refresh
          </button>

          {/* Export Report */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1"
          >
            <span>↓</span> Export CSV
          </button>

          {/* Quick Record Payment Action */}
          <button
            type="button"
            onClick={() => {
              setRecordPaymentLoanId(undefined as any);
              setShowRecordPaymentModal(true);
            }}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1"
          >
            <span>+</span> Record Repayment
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold ml-2 text-rose-700">
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="font-bold ml-2 text-emerald-700">
            &times;
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. Core Executive KPI Metric Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="space-y-4">
        {/* Tier 1: Primary Financial Volumes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Outstanding Portfolio"
            value={formatTZS(dashboardData?.metrics.outstandingPortfolio || 0)}
            subtext="Active amortizing facilities balance"
          />
          <StatCard
            label="Gross Disbursed Amount"
            value={formatTZS(dashboardData?.metrics.disbursedAmount || 0)}
            subtext="Total institutional credit deployed"
          />
          <StatCard
            label="Total Repayments Collected"
            value={formatTZS(dashboardData?.metrics.totalRepayments || 0)}
            subtext="Net reconciled borrower receipts"
          />
          <StatCard
            label="Total Overdue Amount"
            value={formatTZS(dashboardData?.metrics.overdueAmount || 0)}
            subtext="Past-due installment obligations"
          />
        </div>

        {/* Tier 2: Pipeline & Account Quantities */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Total Customers
            </span>
            <span className="font-mono text-xl font-extrabold text-slate-900 mt-1 block">
              {dashboardData?.metrics.totalCustomers ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Registered on file</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Active Loans
            </span>
            <span className="font-mono text-xl font-extrabold text-emerald-800 mt-1 block">
              {dashboardData?.metrics.activeLoans ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Currently amortizing</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Pending Applications
            </span>
            <span className="font-mono text-xl font-extrabold text-indigo-900 mt-1 block">
              {dashboardData?.metrics.pendingApplications ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">In underwriting queue</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Approved Facilities
            </span>
            <span className="font-mono text-xl font-extrabold text-blue-900 mt-1 block">
              {dashboardData?.metrics.approvedLoans ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Pending disbursement</span>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Completed Facilities
            </span>
            <span className="font-mono text-xl font-extrabold text-slate-700 mt-1 block">
              {dashboardData?.metrics.completedLoans ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Closed & paid off</span>
          </div>
        </div>

        {/* Tier 3: Portfolio at Risk (PAR) Indicator Strip */}
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Portfolio at Risk (PAR) & Credit Quality Surveillance
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Benchmark Target: PAR30 &lt; 5.0%
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                PAR 30 Indicator
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold font-mono text-amber-400">
                  {dashboardData?.metrics.par.par30Ratio ?? 0}%
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatTZS(dashboardData?.metrics.par.par30Amount || 0)}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Overdue &gt; 30 Days</span>
            </div>

            <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                PAR 60 Indicator
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold font-mono text-orange-400">
                  {dashboardData?.metrics.par.par60Ratio ?? 0}%
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatTZS(dashboardData?.metrics.par.par60Amount || 0)}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Overdue &gt; 60 Days</span>
            </div>

            <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                PAR 90 / NPL Ratio
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold font-mono text-rose-400">
                  {dashboardData?.metrics.par.par90Ratio ?? 0}%
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {formatTZS(dashboardData?.metrics.par.par90Amount || 0)}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Non-Performing Loans</span>
            </div>

            <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/60">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Facility Delinquency Rate
              </span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold font-mono text-slate-200">
                  {dashboardData?.metrics.par.delinquencyRate ?? 0}%
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Active facilities with arrears
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Portfolio impairment rate</span>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Visual Analytics & Charts Grid */}
      {/* -------------------------------------------------------------------- */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Portfolio Visual Analytics & Risk Trends
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time multi-dimensional database projections across disbursements, collections, portfolios, and credit risk.
            </p>
          </div>

          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-semibold self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartViewMode('ALL')}
              className={`px-2.5 py-1 rounded transition-colors ${
                chartViewMode === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All 7 Charts
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('FLOW')}
              className={`px-2.5 py-1 rounded transition-colors ${
                chartViewMode === 'FLOW' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cash Flows
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('PORTFOLIO')}
              className={`px-2.5 py-1 rounded transition-colors ${
                chartViewMode === 'PORTFOLIO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Portfolio & Branches
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('RISK')}
              className={`px-2.5 py-1 rounded transition-colors ${
                chartViewMode === 'RISK' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Arrears & Approvals
            </button>
          </div>
        </div>

        {/* 7 Key Visual Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Loan Disbursement Over Time */}
          {(chartViewMode === 'ALL' || chartViewMode === 'FLOW') && (
            <ChartCard
              title="Loan Disbursement Over Time"
              subtitle="Monthly credit capital deployments and originated facility volume"
            >
              {dashboardData?.charts.disbursementOverTime ? (
                <DisbursementOverTimeChart disbursements={dashboardData.charts.disbursementOverTime} />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
              )}
            </ChartCard>
          )}

          {/* Chart 2: Repayments Over Time */}
          {(chartViewMode === 'ALL' || chartViewMode === 'FLOW') && (
            <ChartCard
              title="Repayments Over Time"
              subtitle="Monthly borrower collections with principal and interest allocation splits"
            >
              {dashboardData?.charts.repaymentsOverTime ? (
                <RepaymentsOverTimeChart repayments={dashboardData.charts.repaymentsOverTime} />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
              )}
            </ChartCard>
          )}

          {/* Dual Flow Comparative View when in FLOW mode or when user wants comparison */}
          {chartViewMode === 'FLOW' && (
            <div className="lg:col-span-2">
              <ChartCard
                title="Disbursement vs Repayments Comparative Cash Flow"
                subtitle="Side-by-side reconciliation of capital deployed vs borrower debt service"
              >
                {dashboardData?.charts.disbursementOverTime ? (
                  <DisbursementAndRepaymentsChart
                    disbursements={dashboardData.charts.disbursementOverTime}
                    repayments={dashboardData.charts.repaymentsOverTime}
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
                )}
              </ChartCard>
            </div>
          )}

          {/* Chart 3: Active vs Completed Loans */}
          {(chartViewMode === 'ALL' || chartViewMode === 'PORTFOLIO') && (
            <ChartCard
              title="Active vs Completed Loans Distribution"
              subtitle="Composition of active amortizing, in-arrears, completed, and pending facilities"
            >
              {dashboardData?.charts.activeVsCompleted ? (
                <ActiveVsCompletedChart distribution={dashboardData.charts.activeVsCompleted} />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
              )}
            </ChartCard>
          )}

          {/* Chart 4: Loan Portfolio by Product */}
          {(chartViewMode === 'ALL' || chartViewMode === 'PORTFOLIO') && (
            <ChartCard
              title="Loan Portfolio by Credit Product"
              subtitle="Outstanding balance volume and concentration percentage per credit line"
            >
              {dashboardData?.charts.portfolioByProduct ? (
                <ProductPortfolioChart products={dashboardData.charts.portfolioByProduct} />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
              )}
            </ChartCard>
          )}

          {/* Chart 5: Loan Portfolio by Branch */}
          {(chartViewMode === 'ALL' || chartViewMode === 'PORTFOLIO') && (
            <ChartCard
              title="Loan Portfolio by Operational Branch"
              subtitle="Facility volume, outstanding principal, and branch-specific PAR indicators"
            >
              {dashboardData?.charts.portfolioByBranch ? (
                <BranchPortfolioChart branches={dashboardData.charts.portfolioByBranch} />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
              )}
            </ChartCard>
          )}

          {/* Chart 6: Overdue Loans Aging */}
          {(chartViewMode === 'ALL' || chartViewMode === 'RISK') && (
            <ChartCard
              title="Overdue Loans Aging Analysis"
              subtitle="Portfolio arrears watermarked into 30, 60, 90, and NPL regulatory brackets"
            >
              {dashboardData?.charts.overdueLoansAging ? (
                <OverdueLoansAgingChart brackets={dashboardData.charts.overdueLoansAging} />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
              )}
            </ChartCard>
          )}

          {/* Chart 7: Application Approval & Rejection Trends */}
          {(chartViewMode === 'ALL' || chartViewMode === 'RISK') && (
            <ChartCard
              title="Application Approval & Rejection Trends"
              subtitle="Monthly underwriting throughput tracking approval rates and review backlog"
            >
              {dashboardData?.charts.applicationTrends ? (
                <ApplicationTrendsChart trends={dashboardData.charts.applicationTrends} />
              ) : (
                <div className="h-48 flex items-center justify-center text-xs text-slate-400">Loading chart...</div>
              )}
            </ChartCard>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Operational Data Tables Section */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-0">
        {/* Table Toolbar & Segmented Switcher */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Operational Ledger & Pipeline Records
            </h3>
            <p className="text-xs text-slate-500">
              Direct access to live applications, payment vouchers, delinquent facilities, and borrowers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search active table records..."
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-56 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
            />

            {/* Segmented Tab Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setActiveTableTab('applications');
                  setTableSearch('');
                }}
                className={`px-3 py-1 rounded transition-colors ${
                  activeTableTab === 'applications'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Applications ({dashboardData?.tables.recentApplications.length || 0})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTableTab('payments');
                  setTableSearch('');
                }}
                className={`px-3 py-1 rounded transition-colors ${
                  activeTableTab === 'payments'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Payments ({dashboardData?.tables.recentPayments.length || 0})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTableTab('overdue');
                  setTableSearch('');
                }}
                className={`px-3 py-1 rounded transition-colors ${
                  activeTableTab === 'overdue'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overdue Loans ({dashboardData?.tables.overdueLoans.length || 0})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTableTab('customers');
                  setTableSearch('');
                }}
                className={`px-3 py-1 rounded transition-colors ${
                  activeTableTab === 'customers'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recent Customers ({dashboardData?.tables.recentCustomers.length || 0})
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Table 1: Recent Loan Applications */}
        {/* ------------------------------------------------------------------ */}
        {activeTableTab === 'applications' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-bold text-[11px]">
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Applicant Borrower</th>
                  <th className="py-3 px-4">Product Line</th>
                  <th className="py-3 px-4 text-right">Requested Amount</th>
                  <th className="py-3 px-4">Term</th>
                  <th className="py-3 px-4">Submission Date</th>
                  <th className="py-3 px-4">Workflow Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                      Loading applications data...
                    </td>
                  </tr>
                ) : filteredApplications.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                      No loan applications found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 text-xs">
                        {app.applicationNumber}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-slate-900">
                          {app.customer
                            ? `${app.customer.firstName} ${app.customer.lastName}`
                            : 'Registered Applicant'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {app.customer?.customerNumber || 'CUST-ON-FILE'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-700">
                        {app.loanProduct?.name || 'Commercial Credit'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatTZS(app.requestedAmount)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-sans">
                        {app.requestedTermMonths} Months
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-sans text-[11px]">
                        {new Date(app.applicationDate || app.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <StatusIndicator status={app.status as any} />
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewAppDetails(app)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors shadow-2xs whitespace-nowrap"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewApplication(app)}
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded text-[11px] font-semibold transition-colors shadow-2xs whitespace-nowrap"
                          >
                            Review & Action
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Table 2: Recent Payments */}
        {/* ------------------------------------------------------------------ */}
        {activeTableTab === 'payments' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-bold text-[11px]">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Borrower & Facility</th>
                  <th className="py-3 px-4">Channel Method</th>
                  <th className="py-3 px-4">Effective Date</th>
                  <th className="py-3 px-4 text-right">Amount (TZS)</th>
                  <th className="py-3 px-4">Allocation Breakdown</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                      Loading payment records...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                      No payment settlements found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">{p.receiptNumber}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.paymentReference}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-slate-900">{p.customerName || 'Borrower'}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{p.loanNumber}</div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-800">
                          {p.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-600 text-[11px]">
                        {new Date(p.paymentDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-800">
                        {formatTZS(p.amount)}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="flex flex-wrap gap-1 text-[9px] font-mono">
                          {p.principalAllocated !== undefined && p.principalAllocated > 0 && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
                              P: {formatTZS(p.principalAllocated)}
                            </span>
                          )}
                          {p.interestAllocated !== undefined && p.interestAllocated > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
                              I: {formatTZS(p.interestAllocated)}
                            </span>
                          )}
                          {p.penaltyAllocated !== undefined && p.penaltyAllocated > 0 && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-800 rounded border border-rose-200">
                              Pen: {formatTZS(p.penaltyAllocated)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(p.id)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold transition-colors shadow-2xs whitespace-nowrap"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Table 3: Overdue Loans */}
        {/* ------------------------------------------------------------------ */}
        {activeTableTab === 'overdue' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-bold text-[11px]">
                  <th className="py-3 px-4">Facility #</th>
                  <th className="py-3 px-4">Borrower Name & Contact</th>
                  <th className="py-3 px-4">Credit Product</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4 text-center">Days Overdue</th>
                  <th className="py-3 px-4 text-right">Overdue Installment</th>
                  <th className="py-3 px-4 text-right">Remaining Balance</th>
                  <th className="py-3 px-4 text-right">Recovery Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                      Loading delinquent loans...
                    </td>
                  </tr>
                ) : filteredOverdueLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 font-sans">
                      No overdue facilities matching search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedOverdueLoans.map((l) => (
                    <tr key={l.id} className="hover:bg-rose-50/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 text-xs">
                        {l.loanNumber}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-slate-900">{l.customerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{l.customerPhone || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-700">{l.productName}</td>
                      <td className="py-3 px-4 font-sans text-slate-600">{l.branchName}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.daysOverdue >= 90
                              ? 'bg-rose-100 text-rose-800'
                              : l.daysOverdue >= 30
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {l.daysOverdue} Days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700">
                        {formatTZS(l.overdueAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatTZS(l.outstandingBalance)}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setRecordPaymentLoanId(l.id);
                            setShowRecordPaymentModal(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold transition-colors shadow-2xs whitespace-nowrap"
                        >
                          Settle Payment
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Table 4: Recent Customers */}
        {/* ------------------------------------------------------------------ */}
        {activeTableTab === 'customers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-bold text-[11px]">
                  <th className="py-3 px-4">Customer #</th>
                  <th className="py-3 px-4">Full Legal Name</th>
                  <th className="py-3 px-4">Phone Contact</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">KYC Status</th>
                  <th className="py-3 px-4 text-center">Active Facilities</th>
                  <th className="py-3 px-4">Registration Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400 font-sans">
                      Loading customer profiles...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400 font-sans">
                      No customer records found matching search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 text-xs">{c.customerNumber}</td>
                      <td className="py-3 px-4 font-sans font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 text-slate-700">{c.phone}</td>
                      <td className="py-3 px-4 text-slate-600 font-sans truncate max-w-44">{c.email}</td>
                      <td className="py-3 px-4 font-sans text-slate-700">{c.branchName}</td>
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.kycStatus === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.kycStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {c.activeLoansCount}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-sans text-[11px]">
                        {new Date(c.registeredAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          type="button"
                          onClick={() => setViewCustomerId(c.id)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold transition-colors shadow-2xs whitespace-nowrap"
                        >
                          View Dossier
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination & Metrics Bar */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing <strong className="text-slate-900">{currentItems.length === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-slate-900">{Math.min(startIndex + pageSize, currentItems.length)}</strong> of{' '}
              <strong className="text-slate-900">{currentItems.length}</strong> records
            </span>
            <span className="text-slate-300">|</span>
            <label className="flex items-center gap-1 text-[11px] text-slate-500">
              Per page:
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-0.5 bg-white border border-slate-300 rounded text-slate-700 text-xs focus:outline-none"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>
          </div>

          <div className="flex items-center gap-1 font-mono text-[11px]">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 border border-slate-200 rounded bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <span className="px-2 text-slate-500 font-sans">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 border border-slate-200 rounded bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Modals Integration */}
      {/* -------------------------------------------------------------------- */}
      {/* 1. Application Review & Underwriting Modal */}
      {reviewApplication && (
        <ApplicationReviewModal
          application={reviewApplication}
          onClose={() => setReviewApplication(null)}
          onSuccess={() => {
            setReviewApplication(null);
            setSuccessMsg('Loan application successfully reviewed & status updated.');
            fetchDashboard(selectedBranch);
          }}
        />
      )}

      {/* 2. Application Details & Timeline Tracker Modal */}
      {viewAppDetails && (
        <ApplicationDetailsModal
          application={viewAppDetails}
          onClose={() => setViewAppDetails(null)}
          onRefresh={() => {
            fetchDashboard(selectedBranch);
          }}
        />
      )}

      {/* 3. Official Payment Receipt Modal */}
      {viewReceipt && (
        <PaymentReceiptModal
          receipt={viewReceipt}
          onClose={() => setViewReceipt(null)}
        />
      )}

      {/* 4. Customer Dossier Modal */}
      {viewCustomerId && (
        <CustomerDossierModal
          customerId={viewCustomerId}
          onClose={() => setViewCustomerId(null)}
          onCustomerUpdated={() => {
            fetchDashboard(selectedBranch);
          }}
          onOpenEdit={() => {}}
        />
      )}

      {/* 5. Record Repayment Settlement Modal */}
      {showRecordPaymentModal && (
        <RecordPaymentModal
          initialLoanId={recordPaymentLoanId || undefined}
          onClose={() => setShowRecordPaymentModal(false)}
          onSuccess={(newPayment) => {
            setShowRecordPaymentModal(false);
            setSuccessMsg(`Repayment voucher ${newPayment.receiptNumber} successfully posted and allocated.`);
            fetchDashboard(selectedBranch);
            if (newPayment.receipt) {
              setViewReceipt(newPayment.receipt);
            }
          }}
        />
      )}
    </div>
  );
};
