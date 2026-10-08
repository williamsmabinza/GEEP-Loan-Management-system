import React, { useState } from 'react';
import {
  DisbursementTrendPoint,
  RepaymentTrendPoint,
  ActiveVsCompletedDistribution,
  ProductPortfolioPoint,
  BranchPortfolioPoint,
  OverdueAgingBracket,
  ApplicationTrendPoint,
} from '../../../shared/types/index.js';
import { formatTZS } from '../../utils/currency.js';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export const ChartCard: React.FC<ChartContainerProps> = ({ title, subtitle, children, action }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
    <div className="flex items-start justify-between gap-2 mb-4">
      <div>
        <h4 className="text-xs font-bold text-slate-900 tracking-tight">{title}</h4>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
    <div className="flex-1 flex flex-col justify-center">{children}</div>
  </div>
);

// ----------------------------------------------------------------------------
// 1. Disbursement & Repayments Over Time (Dual-Series Bar Chart)
// ----------------------------------------------------------------------------
interface TrendsChartProps {
  disbursements: DisbursementTrendPoint[];
  repayments: RepaymentTrendPoint[];
}

export const DisbursementAndRepaymentsChart: React.FC<TrendsChartProps> = ({
  disbursements,
  repayments,
}) => {
  const [activeMetric, setActiveMetric] = useState<'BOTH' | 'DISBURSEMENTS' | 'REPAYMENTS'>('BOTH');

  const maxVal = Math.max(
    ...disbursements.map((d) => d.amount),
    ...repayments.map((r) => r.amount),
    1000000
  );

  return (
    <div className="space-y-4">
      {/* Legend & Filter Controls */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-4">
          {(activeMetric === 'BOTH' || activeMetric === 'DISBURSEMENTS') && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-indigo-600 inline-block" />
              <span className="font-medium text-slate-700">Disbursed Volume</span>
            </div>
          )}
          {(activeMetric === 'BOTH' || activeMetric === 'REPAYMENTS') && (
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-emerald-600 inline-block" />
              <span className="font-medium text-slate-700">Repayments Collected</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => setActiveMetric('BOTH')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeMetric === 'BOTH' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('DISBURSEMENTS')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeMetric === 'DISBURSEMENTS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Disbursed
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('REPAYMENTS')}
            className={`px-2 py-0.5 rounded transition-colors ${
              activeMetric === 'REPAYMENTS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Repaid
          </button>
        </div>
      </div>

      {/* SVG Bar Visualization */}
      <div className="h-52 w-full flex items-end justify-between gap-2 pt-6 pb-2 border-b border-slate-100">
        {disbursements.map((dItem, idx) => {
          const rItem = repayments[idx] || { amount: 0 };
          const dHeight = Math.max(4, (dItem.amount / maxVal) * 160);
          const rHeight = Math.max(4, (rItem.amount / maxVal) * 160);

          return (
            <div key={dItem.period} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white rounded p-1.5 text-[9px] pointer-events-none z-30 whitespace-nowrap shadow-lg">
                <div className="font-bold border-b border-slate-700 pb-0.5 mb-0.5">{dItem.period}</div>
                <div>Disbursed: {formatTZS(dItem.amount)} ({dItem.count} loans)</div>
                <div>Repaid: {formatTZS(rItem.amount)}</div>
              </div>

              {/* Bars Pair */}
              <div className="w-full flex items-end justify-center gap-1 h-44">
                {(activeMetric === 'BOTH' || activeMetric === 'DISBURSEMENTS') && (
                  <div
                    style={{ height: `${dHeight}px` }}
                    className="w-1/2 max-w-[18px] bg-indigo-600 hover:bg-indigo-700 rounded-t-sm transition-all"
                  />
                )}
                {(activeMetric === 'BOTH' || activeMetric === 'REPAYMENTS') && (
                  <div
                    style={{ height: `${rHeight}px` }}
                    className="w-1/2 max-w-[18px] bg-emerald-600 hover:bg-emerald-700 rounded-t-sm transition-all"
                  />
                )}
              </div>

              {/* Label */}
              <span className="text-[10px] text-slate-500 font-mono mt-1 text-center truncate max-w-full">
                {dItem.period.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Dedicated: Loan Disbursement Over Time Chart
// ----------------------------------------------------------------------------
export const DisbursementOverTimeChart: React.FC<{ disbursements: DisbursementTrendPoint[] }> = ({
  disbursements,
}) => {
  const maxVal = Math.max(...disbursements.map((d) => d.amount), 1000000);
  const totalVolume = disbursements.reduce((sum, d) => sum + d.amount, 0);
  const totalLoans = disbursements.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-mono border-b border-slate-100 pb-2">
        <div>
          <span className="text-slate-500 text-[11px] block font-sans">Period Total Disbursed</span>
          <span className="font-bold text-slate-900 text-sm">{formatTZS(totalVolume)}</span>
        </div>
        <div className="text-right">
          <span className="text-slate-500 text-[11px] block font-sans">Disbursed Facilities</span>
          <span className="font-bold text-indigo-700 text-sm">{totalLoans} Loans</span>
        </div>
      </div>

      <div className="h-44 w-full flex items-end justify-between gap-2 pt-4 pb-2">
        {disbursements.map((item) => {
          const height = Math.max(6, (item.amount / maxVal) * 130);
          return (
            <div key={item.period} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute -top-14 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white rounded p-1.5 text-[9px] pointer-events-none z-30 whitespace-nowrap shadow-lg">
                <div className="font-bold">{item.period}</div>
                <div>Volume: {formatTZS(item.amount)}</div>
                <div>Count: {item.count} facilities</div>
              </div>

              <div className="w-full flex items-end justify-center h-32">
                <div
                  style={{ height: `${height}px` }}
                  className="w-full max-w-[28px] bg-indigo-600 hover:bg-indigo-700 rounded-t-sm transition-all"
                />
              </div>

              <span className="text-[10px] text-slate-500 font-mono mt-1 text-center truncate max-w-full">
                {item.period.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Dedicated: Repayments Over Time Chart
// ----------------------------------------------------------------------------
export const RepaymentsOverTimeChart: React.FC<{ repayments: RepaymentTrendPoint[] }> = ({
  repayments,
}) => {
  const maxVal = Math.max(...repayments.map((r) => r.amount), 1000000);
  const totalVolume = repayments.reduce((sum, r) => sum + r.amount, 0);
  const totalPrincipal = repayments.reduce((sum, r) => sum + (r.principal || 0), 0);
  const totalInterest = repayments.reduce((sum, r) => sum + (r.interest || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-mono border-b border-slate-100 pb-2">
        <div>
          <span className="text-slate-500 text-[11px] block font-sans">Total Collected</span>
          <span className="font-bold text-slate-900 text-sm">{formatTZS(totalVolume)}</span>
        </div>
        <div className="flex items-center gap-3 text-right">
          <div>
            <span className="text-slate-500 text-[10px] block font-sans">Principal</span>
            <span className="font-bold text-emerald-800 text-xs">{formatTZS(totalPrincipal)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block font-sans">Interest & Fees</span>
            <span className="font-bold text-blue-800 text-xs">{formatTZS(totalInterest)}</span>
          </div>
        </div>
      </div>

      <div className="h-44 w-full flex items-end justify-between gap-2 pt-4 pb-2">
        {repayments.map((item) => {
          const totalHeight = Math.max(6, (item.amount / maxVal) * 130);
          const pPct = item.amount > 0 ? (item.principal / item.amount) : 0.8;
          const pHeight = totalHeight * pPct;
          const iHeight = totalHeight - pHeight;

          return (
            <div key={item.period} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white rounded p-1.5 text-[9px] pointer-events-none z-30 whitespace-nowrap shadow-lg">
                <div className="font-bold">{item.period}</div>
                <div>Total: {formatTZS(item.amount)}</div>
                <div className="text-emerald-300">Principal: {formatTZS(item.principal)}</div>
                <div className="text-blue-300">Interest: {formatTZS(item.interest)}</div>
              </div>

              <div className="w-full flex flex-col justify-end items-center h-32">
                <div
                  style={{ height: `${iHeight}px` }}
                  className="w-full max-w-[28px] bg-blue-600 rounded-t-sm"
                />
                <div
                  style={{ height: `${pHeight}px` }}
                  className="w-full max-w-[28px] bg-emerald-600 hover:bg-emerald-700 transition-all"
                />
              </div>

              <span className="text-[10px] text-slate-500 font-mono mt-1 text-center truncate max-w-full">
                {item.period.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// 2. Active vs Completed Loans Distribution (Donut & Breakdown)
// ----------------------------------------------------------------------------
interface ActiveVsCompletedProps {
  distribution: ActiveVsCompletedDistribution;
}

export const ActiveVsCompletedChart: React.FC<ActiveVsCompletedProps> = ({ distribution }) => {
  const total =
    distribution.activeCount +
    distribution.completedCount +
    distribution.inArrearsCount +
    distribution.pendingDisbursementCount || 1;

  const segments = [
    {
      label: 'Active Performing',
      count: distribution.activeCount - distribution.inArrearsCount,
      volume: Math.max(0, distribution.activeVolume - distribution.inArrearsVolume),
      color: 'bg-emerald-600',
      textColor: 'text-emerald-700',
    },
    {
      label: 'In Arrears / Delinquent',
      count: distribution.inArrearsCount,
      volume: distribution.inArrearsVolume,
      color: 'bg-rose-600',
      textColor: 'text-rose-700',
    },
    {
      label: 'Completed & Closed',
      count: distribution.completedCount,
      volume: distribution.completedVolume,
      color: 'bg-indigo-600',
      textColor: 'text-indigo-700',
    },
    {
      label: 'Pending Disbursement',
      count: distribution.pendingDisbursementCount,
      volume: distribution.pendingDisbursementVolume,
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Proportion Bar */}
      <div className="h-3.5 w-full bg-slate-100 rounded-md overflow-hidden flex shadow-inner">
        {segments.map((seg) => {
          const pct = (seg.count / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.label}
              style={{ width: `${pct}%` }}
              className={`${seg.color} transition-all`}
              title={`${seg.label}: ${seg.count} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {segments.map((seg) => {
          const pct = Math.round((seg.count / total) * 100);
          return (
            <div key={seg.label} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`h-2.5 w-2.5 rounded-xs ${seg.color}`} />
                <span className="font-semibold text-slate-800 text-[11px] truncate">{seg.label}</span>
              </div>
              <div className="flex items-baseline justify-between font-mono">
                <span className="text-base font-bold text-slate-900">{seg.count}</span>
                <span className={`text-[10px] font-bold ${seg.textColor}`}>{pct}%</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                {formatTZS(seg.volume)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// 3. Loan Portfolio by Product (Horizontal Progress List)
// ----------------------------------------------------------------------------
interface ProductPortfolioProps {
  products: ProductPortfolioPoint[];
}

export const ProductPortfolioChart: React.FC<ProductPortfolioProps> = ({ products }) => {
  return (
    <div className="space-y-3.5">
      {products.map((p) => (
        <div key={p.productId} className="space-y-1">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-800 font-bold truncate max-w-[55%]">
              {p.productName}
            </span>
            <div className="font-mono text-[11px] text-right">
              <span className="text-slate-900 font-bold">{formatTZS(p.outstandingBalance)}</span>
              <span className="text-slate-400 ml-1.5">({p.percentageOfPortfolio}%)</span>
            </div>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              style={{ width: `${Math.min(100, p.percentageOfPortfolio)}%` }}
              className="h-full bg-indigo-600 rounded-full"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>Code: {p.productCode}</span>
            <span>{p.loanCount} Active Facilities</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ----------------------------------------------------------------------------
// 4. Loan Portfolio by Branch (Comparative Grid)
// ----------------------------------------------------------------------------
interface BranchPortfolioProps {
  branches: BranchPortfolioPoint[];
}

export const BranchPortfolioChart: React.FC<BranchPortfolioProps> = ({ branches }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {branches.map((b) => (
        <div key={b.branchId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-xs truncate max-w-[65%]">
              {b.branchName}
            </span>
            <span className="font-mono text-[10px] text-slate-500 font-bold">
              {b.branchCode}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">Portfolio Balance</span>
              <span className="font-extrabold text-slate-900">{formatTZS(b.outstandingBalance)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-sans">Active Loans</span>
              <span className="font-bold text-slate-800">{b.activeLoans} Facilities</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] border-t border-slate-200/60 pt-1.5 font-mono">
            <span className="text-slate-500">Overdue: {formatTZS(b.overdueAmount)}</span>
            <span className={`font-bold ${b.parRatio > 5 ? 'text-rose-700' : 'text-emerald-700'}`}>
              PAR: {b.parRatio}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ----------------------------------------------------------------------------
// 5. Overdue Loans Aging Analysis (Risk Waterfall)
// ----------------------------------------------------------------------------
interface OverdueAgingProps {
  brackets: OverdueAgingBracket[];
}

export const OverdueLoansAgingChart: React.FC<OverdueAgingProps> = ({ brackets }) => {
  const maxOverdue = Math.max(...brackets.map((b) => b.overdueAmount), 1000000);

  return (
    <div className="space-y-3">
      {brackets.map((b, idx) => {
        const barWidth = Math.max(3, (b.overdueAmount / maxOverdue) * 100);
        const color =
          idx === 0
            ? 'bg-amber-500'
            : idx === 1
            ? 'bg-orange-500'
            : idx === 2
            ? 'bg-rose-600'
            : 'bg-rose-800';

        return (
          <div key={b.bracket} className="space-y-1">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-800 font-semibold text-[11px] truncate">
                {b.bracket}
              </span>
              <div className="font-mono text-right text-[11px]">
                <span className="text-slate-900 font-bold">{formatTZS(b.overdueAmount)}</span>
                <span className="text-slate-500 ml-1">({b.loanCount} loans)</span>
              </div>
            </div>

            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div style={{ width: `${barWidth}%` }} className={`h-full ${color} rounded-full`} />
            </div>

            <div className="text-[10px] text-slate-400 font-mono text-right">
              Total Facility Exposure: {formatTZS(b.outstandingBalance)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ----------------------------------------------------------------------------
// 6. Application Approval & Rejection Trends (Monthly Waterfall)
// ----------------------------------------------------------------------------
interface ApplicationTrendsProps {
  trends: ApplicationTrendPoint[];
}

export const ApplicationTrendsChart: React.FC<ApplicationTrendsProps> = ({ trends }) => {
  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
          <span className="text-slate-700">Approved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-indigo-600" />
          <span className="text-slate-700">Under Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-rose-600" />
          <span className="text-slate-700">Rejected</span>
        </div>
      </div>

      {/* Horizontal Stacked Rows */}
      <div className="space-y-2.5">
        {trends.map((t) => {
          const total = Math.max(1, t.submitted);
          const approvedPct = (t.approved / total) * 100;
          const reviewPct = (t.underReview / total) * 100;
          const rejectedPct = (t.rejected / total) * 100;

          return (
            <div key={t.period} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="font-bold text-slate-800">{t.period}</span>
                <span className="text-slate-500">{t.submitted} Originations</span>
              </div>

              <div className="h-2.5 w-full bg-slate-100 rounded-md overflow-hidden flex">
                <div style={{ width: `${approvedPct}%` }} className="bg-emerald-600" title={`Approved: ${t.approved}`} />
                <div style={{ width: `${reviewPct}%` }} className="bg-indigo-600" title={`Under Review: ${t.underReview}`} />
                <div style={{ width: `${rejectedPct}%` }} className="bg-rose-600" title={`Rejected: ${t.rejected}`} />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="text-emerald-700">✓ {t.approved} Approved</span>
                <span className="text-indigo-700">⏱ {t.underReview} Review</span>
                <span className="text-rose-700">✕ {t.rejected} Rejected</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
