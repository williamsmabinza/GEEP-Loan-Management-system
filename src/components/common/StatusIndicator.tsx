import React from 'react';
import { LoanStatus, PaymentStatus } from '../../../shared/types/index.js';

interface StatusIndicatorProps {
  status: LoanStatus | PaymentStatus | string;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, className = '' }) => {
  // Financial domain semantic color mappings
  let dotColor = 'bg-slate-400';
  let textColor = 'text-slate-700';
  let formattedLabel = status.replace(/_/g, ' ');

  switch (status) {
    case 'ACTIVE':
    case 'COMPLETED':
    case 'APPROVED':
      dotColor = 'bg-emerald-600';
      textColor = 'text-emerald-800';
      break;
    case 'PENDING_DISBURSEMENT':
      dotColor = 'bg-indigo-600';
      textColor = 'text-indigo-800';
      break;
    case 'REVISION_REQUESTED':
      dotColor = 'bg-amber-600';
      textColor = 'text-amber-800';
      break;
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'PENDING':
    case 'SCHEDULED':
      dotColor = 'bg-amber-500';
      textColor = 'text-amber-800';
      break;
    case 'DISBURSED':
      dotColor = 'bg-blue-600';
      textColor = 'text-blue-800';
      break;
    case 'REJECTED':
    case 'DELINQUENT':
    case 'FAILED':
    case 'DEFAULTED':
      dotColor = 'bg-rose-600';
      textColor = 'text-rose-800';
      break;
    case 'CLOSED':
      dotColor = 'bg-slate-400';
      textColor = 'text-slate-600';
      break;
  }

  // Anti-slop zero-pill discipline: unboxed subtle text with clean status indicator dot
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium tracking-tight ${textColor} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} aria-hidden="true" />
      <span>{formattedLabel}</span>
    </span>
  );
};
