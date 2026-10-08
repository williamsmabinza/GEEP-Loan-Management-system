import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, subtext, trend }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 transition-colors">
      <div className="text-xs font-medium text-slate-500 tracking-wide uppercase">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 font-mono tabular-nums tracking-tight">
        {value}
      </div>
      {(subtext || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
          {trend && (
            <span
              className={`font-medium font-mono tabular-nums ${
                trend.isPositive ? 'text-emerald-700' : 'text-slate-600'
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
};
