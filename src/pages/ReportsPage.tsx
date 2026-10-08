import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { formatTZS } from '../utils/currency.js';
import {
  ReportType,
  ReportFilterParams,
  ReportResponseDTO,
  ReportFilterOptionsDTO,
} from '../../shared/types/index.js';

interface ReportCategory {
  title: string;
  items: Array<{
    id: ReportType;
    label: string;
    description: string;
    icon: string;
    badge?: string;
  }>;
}

const REPORT_CATALOG: ReportCategory[] = [
  {
    title: 'Credit & Lending Portfolio',
    items: [
      {
        id: 'LOAN_PORTFOLIO',
        label: 'Loan Portfolio Master',
        description: 'Complete credit facility ledger, outstanding exposure, servicing status and maturity schedule.',
        icon: '💼',
        badge: 'Core Ledger',
      },
      {
        id: 'LOAN_APPLICATIONS',
        label: 'Loan Applications Pipeline',
        description: 'Origination pipeline tracking requested vs approved amounts, appraisal workflow, and turnaround.',
        icon: '📝',
      },
      {
        id: 'LOAN_DISBURSEMENTS',
        label: 'Loan Disbursements',
        description: 'Capital deployment ledger with payment vouchers, disbursement channels, and officer verification.',
        icon: '💸',
      },
      {
        id: 'OUTSTANDING_BALANCES',
        label: 'Outstanding Balances',
        description: 'Active amortizing balances tracking principal repayments, amortization progress, and exposure.',
        icon: '⚖️',
      },
      {
        id: 'OVERDUE_LOANS',
        label: 'Overdue Loans & PAR',
        description: 'Portfolio at Risk (PAR 30, 60, 90+ days), past-due installments, and non-performing loan surveillance.',
        icon: '⚠️',
        badge: 'Surveillance',
      },
    ],
  },
  {
    title: 'Debt Servicing & Collections',
    items: [
      {
        id: 'REPAYMENTS',
        label: 'Repayments Reconciled',
        description: 'Settled borrower transactions decomposed into principal, interest, fees, and penalty allocations.',
        icon: '📥',
      },
      {
        id: 'COLLECTION_PERFORMANCE',
        label: 'Collection Efficiency',
        description: 'Scheduled vs actual debt service recovery, collection efficiency percentages, and on-time compliance.',
        icon: '📈',
        badge: 'Yield & Efficiency',
      },
    ],
  },
  {
    title: 'Financial Revenues & Earnings',
    items: [
      {
        id: 'INCOME_FROM_INTEREST',
        label: 'Income from Interest',
        description: 'Accrued and collected contractual interest earnings recognized from amortizing debt facilities.',
        icon: '💰',
      },
      {
        id: 'FEES_COLLECTED',
        label: 'Fees Collected',
        description: 'Origination charges, administrative fees, underwriting deductions, and facility processing revenues.',
        icon: '🏷️',
      },
      {
        id: 'PENALTIES_COLLECTED',
        label: 'Penalties Collected',
        description: 'Delinquency penalties, late payment assessments, and defaulted loan surcharge collections.',
        icon: '🛡️',
      },
    ],
  },
  {
    title: 'Institutional & Operational Analytics',
    items: [
      {
        id: 'CUSTOMER_REPORT',
        label: 'Customer Demographics',
        description: 'Borrower directory tracking KYC compliance, credit scores, active facility count, and total exposure.',
        icon: '👥',
      },
      {
        id: 'LOAN_PRODUCT_PERFORMANCE',
        label: 'Product Performance',
        description: 'Credit product line profitability, portfolio share, deployed capital, and risk concentration.',
        icon: '📦',
      },
      {
        id: 'BRANCH_PERFORMANCE',
        label: 'Branch Performance',
        description: 'Comparative regional branch metrics tracking active facility count, collections, and localized PAR.',
        icon: '🏛️',
      },
      {
        id: 'STAFF_PERFORMANCE',
        label: 'Staff Performance',
        description: 'Loan officer originations throughput, credit committee appraisals, and collections credited.',
        icon: '👔',
      },
    ],
  },
];

export const ReportsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();

  // Report Selection State
  const [activeReportType, setActiveReportType] = useState<ReportType>('LOAN_PORTFOLIO');

  // Filter Configuration State
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptionsDTO | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination & Sorting State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Query Execution State
  const [reportData, setReportData] = useState<ReportResponseDTO | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<'csv' | 'pdf' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canViewReports = hasPermission('report.view');
  const canExportReports = hasPermission('report.export');

  // Load filter options on mount
  useEffect(() => {
    let isMounted = true;
    async function loadOptions() {
      try {
        const opts = await api.reports.getFilterOptions();
        if (isMounted) {
          setFilterOptions(opts);
          if (opts.isBranchRestricted && opts.userBranchId) {
            setSelectedBranch(opts.userBranchId);
          }
        }
      } catch (err) {
        console.warn('Failed to load dynamic filter options, fallback defaults active:', err);
      }
    }
    loadOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch report data from backend
  const fetchReport = useCallback(async () => {
    if (!canViewReports) {
      setError('You are not authorized to view financial and portfolio reports.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const filterParams: ReportFilterParams = {
      reportType: activeReportType,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
      productId: selectedProduct || undefined,
      status: selectedStatus || undefined,
      customerId: selectedCustomer || undefined,
      staffId: selectedStaff || undefined,
      search: searchQuery || undefined,
      page,
      pageSize,
      sortBy: sortBy || undefined,
      sortOrder,
    };

    try {
      const response = await api.reports.queryReport(filterParams);
      setReportData(response);
    } catch (err) {
      setError((err as Error).message || 'Failed to query and calculate report data');
    } finally {
      setIsLoading(false);
    }
  }, [
    activeReportType,
    startDate,
    endDate,
    selectedBranch,
    selectedProduct,
    selectedStatus,
    selectedCustomer,
    selectedStaff,
    searchQuery,
    page,
    pageSize,
    sortBy,
    sortOrder,
    canViewReports,
  ]);

  // Execute query on dependency changes
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Switch report type handler
  const handleSelectReport = (type: ReportType) => {
    if (type === activeReportType) return;
    setActiveReportType(type);
    setPage(1);
    setSortBy('');
    setSortOrder('asc');
    setSelectedStatus('');
  };

  // Preset Date Range Helpers
  const handleDatePreset = (preset: 'today' | 'this_month' | 'last_30_days' | 'this_year' | 'all') => {
    const today = new Date();
    setPage(1);

    if (preset === 'today') {
      const d = today.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (preset === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else if (preset === 'last_30_days') {
      const prior = new Date();
      prior.setDate(today.getDate() - 30);
      setStartDate(prior.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'this_year') {
      const firstDay = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      const lastDay = new Date(today.getFullYear(), 11, 31).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    if (!filterOptions?.isBranchRestricted) {
      setSelectedBranch('ALL');
    }
    setSelectedProduct('');
    setSelectedStatus('');
    setSelectedCustomer('');
    setSelectedStaff('');
    setSearchQuery('');
    setPage(1);
    setSortBy('');
    setSortOrder('asc');
  };

  // Handle Sort column click
  const handleHeaderSort = (columnKey: string) => {
    setPage(1);
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnKey);
      setSortOrder('asc');
    }
  };

  // Handle Export (CSV or PDF/Print)
  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!canExportReports) {
      setError('You do not possess regulatory permissions to export financial reports.');
      return;
    }

    setIsExporting(format);
    try {
      const filterParams: ReportFilterParams = {
        reportType: activeReportType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        branchId: selectedBranch !== 'ALL' ? selectedBranch : undefined,
        productId: selectedProduct || undefined,
        status: selectedStatus || undefined,
        customerId: selectedCustomer || undefined,
        staffId: selectedStaff || undefined,
        search: searchQuery || undefined,
        sortBy: sortBy || undefined,
        sortOrder,
      };

      const result = await api.reports.exportReport(filterParams, format);

      if (format === 'csv') {
        const fileContent = result.csvContent || result.content;
        const blob = new Blob([fileContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', result.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        // Open print-ready HTML in new window which automatically launches print dialog
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(result.content);
          printWindow.document.close();
        } else {
          // Fallback download if popup blocked
          const blob = new Blob([result.content], { type: 'text/html;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.setAttribute('href', url);
          link.setAttribute('download', result.filename);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      setError((err as Error).message || `Failed to export ${format.toUpperCase()} report.`);
    } finally {
      setIsExporting(null);
    }
  };

  // Format table cell values based on column metadata
  const renderCellValue = (row: any, col: any) => {
    const val = row[col.key];

    if (val === undefined || val === null || val === '') {
      return <span className="text-slate-400 font-sans text-xs">-</span>;
    }

    if (col.isCurrency && typeof val === 'number') {
      return <span className="font-mono font-medium text-slate-900">{formatTZS(val)}</span>;
    }

    if (col.isDate) {
      const d = new Date(val);
      return (
        <span className="font-sans text-slate-700 text-xs">
          {isNaN(d.getTime()) ? String(val) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
        </span>
      );
    }

    if (col.isNumeric) {
      return <span className="font-mono text-slate-800">{typeof val === 'number' ? val.toLocaleString() : val}</span>;
    }

    if (col.isBadge) {
      const strVal = String(val).toUpperCase();
      let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';

      if (['ACTIVE', 'DISBURSED', 'APPROVED', 'VERIFIED', 'PAID', 'CLOSED_PAID_OFF'].includes(strVal)) {
        badgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      } else if (['SUBMITTED', 'UNDER_REVIEW', 'PENDING', 'SCHEDULED', 'RECOMMENDED'].includes(strVal)) {
        badgeStyle = 'bg-blue-50 text-blue-800 border-blue-200';
      } else if (['IN_ARREARS', 'WATCHLIST', 'PARTIALLY_PAID'].includes(strVal) || strVal.includes('PAR 30') || strVal.includes('EARLY')) {
        badgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
      } else if (['DELINQUENT', 'DEFAULTED', 'REJECTED', 'OVERDUE', 'CANCELLED'].includes(strVal) || strVal.includes('90+') || strVal.includes('NPL')) {
        badgeStyle = 'bg-rose-50 text-rose-800 border-rose-200';
      }

      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeStyle}`}>
          {String(val).replace(/_/g, ' ')}
        </span>
      );
    }

    return <span className="font-sans text-slate-800 text-xs">{String(val)}</span>;
  };

  // Available statuses according to active report type
  const availableStatuses = activeReportType === 'LOAN_APPLICATIONS'
    ? filterOptions?.applicationStatuses || ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']
    : activeReportType === 'CUSTOMER_REPORT'
    ? ['ACTIVE', 'INACTIVE', 'VERIFIED', 'PENDING', 'SUSPENDED']
    : filterOptions?.loanStatuses || ['ACTIVE', 'DISBURSED', 'IN_ARREARS', 'DELINQUENT', 'CLOSED_PAID_OFF'];

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header Banner & Executive Actions */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-900 text-white rounded text-sm">📊</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              Financial & Portfolio Reporting Engine
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl font-sans">
            Institutional microfinance analytics, portfolio aging surveillance, cashflow reconciliations, and regulatory BOT audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchReport()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh current report query"
          >
            <span>🔄</span>
            <span>{isLoading ? 'Running...' : 'Refresh Query'}</span>
          </button>

          {canExportReports && (
            <>
              <button
                disabled={isLoading || !!isExporting}
                onClick={() => handleExport('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                title="Download complete dataset as CSV"
              >
                <span>📥</span>
                <span>{isExporting === 'csv' ? 'Exporting...' : 'Export CSV'}</span>
              </button>

              <button
                disabled={isLoading || !!isExporting}
                onClick={() => handleExport('pdf')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-800 bg-white rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
                title="Open formatted document ready for printing or PDF save"
              >
                <span>🖨️</span>
                <span>{isExporting === 'pdf' ? 'Preparing...' : 'Print / Save PDF'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Security & Access Notice */}
      {!canViewReports && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
          <p className="font-semibold">Access Restricted</p>
          <p className="mt-0.5">
            Your user account ({user?.role}) does not possess the <code>report.view</code> permission required to access institutional financial records.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Catalog of All 14 Reports */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Select Institutional Report (14 Regulatory Standards)
            </h2>
            <p className="text-[11px] text-slate-500">
              Click any report to configure parametric filters and load the real-time calculated ledger
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
            Active: {reportData?.title || 'Report Ledger'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {REPORT_CATALOG.map((category) => (
            <div key={category.title} className="space-y-2">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                {category.title}
              </h3>
              <div className="space-y-1.5">
                {category.items.map((item) => {
                  const isActive = item.id === activeReportType;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectReport(item.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs ${
                        isActive
                          ? 'bg-slate-900 border-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                          : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-medium truncate">
                          <span>{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${
                              isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[10px] mt-1 line-clamp-1 ${
                          isActive ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {item.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Parametric Filter Toolbar */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Filter Parameters & Jurisdictions
            </span>
            {filterOptions?.isBranchRestricted && (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-medium">
                Scoped to Assigned Branch
              </span>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-slate-400 mr-1">Date presets:</span>
            <button
              onClick={() => handleDatePreset('today')}
              className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => handleDatePreset('this_month')}
              className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => handleDatePreset('last_30_days')}
              className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handleDatePreset('this_year')}
              className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              This Year
            </button>
            <button
              onClick={() => handleDatePreset('all')}
              className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              All Time
            </button>
          </div>
        </div>

        {/* Dynamic Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* 1. Date Range: Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            />
          </div>

          {/* 2. Date Range: End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            />
          </div>

          {/* 3. Branch Jurisdiction */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Branch Jurisdiction
            </label>
            <select
              value={selectedBranch}
              disabled={filterOptions?.isBranchRestricted}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white disabled:bg-slate-50"
            >
              {!filterOptions?.isBranchRestricted && (
                <option value="ALL">All Branches (Institution-Wide)</option>
              )}
              {filterOptions?.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Loan Product */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Loan Product
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            >
              <option value="">All Loan Products</option>
              {filterOptions?.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* 5. Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Status Filter
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            >
              <option value="">All Statuses</option>
              {availableStatuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Loan Officer / Staff */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Loan Officer / Staff
            </label>
            <select
              value={selectedStaff}
              onChange={(e) => {
                setSelectedStaff(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            >
              <option value="">All Officers & Personnel</option>
              {filterOptions?.staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* 7. Customer Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Customer Account
            </label>
            <select
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            >
              <option value="">All Borrowers</option>
              {filterOptions?.customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.customerNumber})
                </option>
              ))}
            </select>
          </div>

          {/* 8. Text Search Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Keyword Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Loan #, Name, Ref..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-7 pr-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white placeholder-slate-400"
              />
              <span className="absolute left-2 top-2 text-slate-400 text-xs">🔍</span>
            </div>
          </div>
        </div>

        {/* Toolbar Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <div className="text-slate-500 font-sans">
            Showing calculations for{' '}
            <span className="font-semibold text-slate-800">
              {reportData?.filtersApplied.branchName || 'Institution-Wide'}
            </span>
            {reportData?.filtersApplied.startDate && (
              <> from <span className="font-mono">{reportData.filtersApplied.startDate}</span></>
            )}
            {reportData?.filtersApplied.endDate && (
              <> to <span className="font-mono">{reportData.filtersApplied.endDate}</span></>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs font-medium transition-colors"
            >
              Reset Filters
            </button>
            <button
              onClick={() => fetchReport()}
              disabled={isLoading}
              className="px-3.5 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Calculated Financial Metrics Summary Cards */}
      {/* ------------------------------------------------------------------ */}
      {reportData?.summary && Object.keys(reportData.summary).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Calculated Financial & Operational Totals
            </h3>
            <span className="text-[11px] text-slate-400 font-sans">
              Reconciled on backend database queries
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Object.entries(reportData.summary).map(([metricLabel, metricValue]) => {
              const isMoney =
                typeof metricValue === 'number' &&
                (metricLabel.toLowerCase().includes('volume') ||
                  metricLabel.toLowerCase().includes('balance') ||
                  metricLabel.toLowerCase().includes('amount') ||
                  metricLabel.toLowerCase().includes('capital') ||
                  metricLabel.toLowerCase().includes('principal') ||
                  metricLabel.toLowerCase().includes('arrears') ||
                  metricLabel.toLowerCase().includes('exposure') ||
                  metricLabel.toLowerCase().includes('earned') ||
                  metricLabel.toLowerCase().includes('interest') ||
                  metricLabel.toLowerCase().includes('fee') ||
                  metricLabel.toLowerCase().includes('penalty') ||
                  metricLabel.toLowerCase().includes('repaid') ||
                  metricLabel.toLowerCase().includes('collected') ||
                  metricLabel.toLowerCase().includes('disbursed'));

              return (
                <div
                  key={metricLabel}
                  className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-1"
                >
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide truncate" title={metricLabel}>
                    {metricLabel}
                  </p>
                  <p className="text-base font-bold font-mono text-slate-900 truncate">
                    {isMoney ? formatTZS(metricValue as number) : String(metricValue)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. On-Screen Dynamic Report Data Table */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden space-y-0">
        {/* Table Header Bar */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 font-sans">
                {reportData?.title || 'Report Output'}
              </h2>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-semibold">
                {reportData?.pagination.totalRecords ?? 0} Records
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">
              {reportData?.description || 'Audited institutional ledger breakdown'}
            </p>
          </div>

          {/* Page Size & Sorting Info */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="text-[11px] text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Scrollable Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-700 select-none">
                {reportData?.columns.map((col) => {
                  const isSorted = sortBy === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleHeaderSort(col.key)}
                      className={`px-3.5 py-2.5 font-semibold text-[11px] uppercase tracking-wider cursor-pointer hover:bg-slate-200/60 transition-colors ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      <div className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                        <span>{col.label}</span>
                        <span className="text-[10px] text-slate-400">
                          {isSorted ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={reportData?.columns.length || 8}
                    className="py-16 text-center text-slate-500 font-sans"
                  >
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                      <span>Executing backend query and compiling financial metrics...</span>
                    </div>
                  </td>
                </tr>
              ) : !reportData || reportData.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={reportData?.columns.length || 8}
                    className="py-16 text-center text-slate-500 font-sans space-y-1"
                  >
                    <p className="font-semibold text-slate-700">No records found matching current criteria</p>
                    <p className="text-xs text-slate-400">
                      Try expanding your date range, adjusting branch filters, or clearing search keywords.
                    </p>
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {reportData.columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3.5 py-3 whitespace-nowrap ${
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {renderCellValue(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 6. Pagination Footer */}
        {/* ------------------------------------------------------------------ */}
        {reportData && reportData.pagination && (
          <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs bg-slate-50/50">
            <div className="text-slate-500 font-sans">
              Showing{' '}
              <span className="font-semibold text-slate-800">
                {reportData.pagination.totalRecords === 0
                  ? 0
                  : (reportData.pagination.page - 1) * reportData.pagination.pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(
                  reportData.pagination.page * reportData.pagination.pageSize,
                  reportData.pagination.totalRecords
                )}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-800">
                {reportData.pagination.totalRecords}
              </span>{' '}
              audited entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={reportData.pagination.page <= 1 || isLoading}
                onClick={() => setPage(1)}
                className="px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                title="First Page"
              >
                ««
              </button>
              <button
                disabled={reportData.pagination.page <= 1 || isLoading}
                onClick={() => setPage(reportData.pagination.page - 1)}
                className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Previous
              </button>

              <span className="px-3 py-1 font-mono text-slate-700 font-semibold bg-white border border-slate-300 rounded">
                Page {reportData.pagination.page} of {reportData.pagination.totalPages}
              </span>

              <button
                disabled={reportData.pagination.page >= reportData.pagination.totalPages || isLoading}
                onClick={() => setPage(reportData.pagination.page + 1)}
                className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Next
              </button>
              <button
                disabled={reportData.pagination.page >= reportData.pagination.totalPages || isLoading}
                onClick={() => setPage(reportData.pagination.totalPages)}
                className="px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                title="Last Page"
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Footnote */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200 pt-3">
        <span>Nexa Microfinance Bank • Regulatory Reporting Standard IFRS-9 & BOT Credit Bureau</span>
        <span>Generated At: {reportData?.generatedAt ? new Date(reportData.generatedAt).toLocaleString() : 'Live'}</span>
      </div>
    </div>
  );
};
