import React from 'react';
import { LoanApplicationStatus } from '../../../shared/types/index.js';

interface ApplicationTimelineTrackerProps {
  status: LoanApplicationStatus;
  approvalDate?: string | null;
  rejectionDate?: string | null;
  disbursedAt?: string | null;
  submittedAt?: string | null;
  rejectionReason?: string | null;
}

interface StepItem {
  key: LoanApplicationStatus;
  label: string;
  description: string;
}

const FLOW_STEPS: StepItem[] = [
  { key: 'DRAFT', label: 'Draft', description: 'Application initiated' },
  { key: 'SUBMITTED', label: 'Submitted', description: 'Awaiting loan officer pickup' },
  { key: 'UNDER_REVIEW', label: 'Under Review', description: 'KYC & documents verified' },
  { key: 'CREDIT_ASSESSMENT', label: 'Credit Assessment', description: 'Credit scoring & DTI appraisal' },
  { key: 'APPROVED', label: 'Approved', description: 'Approved by underwriting committee' },
  { key: 'DISBURSED', label: 'Disbursed', description: 'Capital released to borrower' },
  { key: 'ACTIVE', label: 'Active', description: 'Facility under active servicing' },
  { key: 'COMPLETED', label: 'Completed', description: 'Facility fully settled & closed' },
];

export const ApplicationTimelineTracker: React.FC<ApplicationTimelineTrackerProps> = ({
  status,
  approvalDate,
  rejectionDate,
  disbursedAt,
  submittedAt,
  rejectionReason,
}) => {
  const isRejected = status === 'REJECTED';
  const isCancelled = status === 'CANCELLED';
  const isRevisionRequested = status === 'REVISION_REQUESTED';

  // Determine active step index
  const getStepIndex = (s: LoanApplicationStatus): number => {
    switch (s) {
      case 'DRAFT':
        return 0;
      case 'SUBMITTED':
        return 1;
      case 'REVISION_REQUESTED':
        return 1;
      case 'UNDER_REVIEW':
        return 2;
      case 'CREDIT_ASSESSMENT':
        return 3;
      case 'APPROVED':
        return 4;
      case 'DISBURSED':
        return 5;
      case 'ACTIVE':
        return 6;
      case 'COMPLETED':
        return 7;
      default:
        return 1;
    }
  };

  const currentIndex = isRejected || isCancelled ? 3 : getStepIndex(status);

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Institutional Underwriting Workflow Pipeline
          </span>
          <h4 className="text-sm font-bold text-slate-900 mt-0.5">
            Application Status: <span className="font-mono">{status.replace('_', ' ')}</span>
          </h4>
        </div>

        <span
          className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-bold font-mono ${
            isRejected
              ? 'bg-rose-100 text-rose-800 border border-rose-300'
              : status === 'APPROVED' || status === 'ACTIVE' || status === 'COMPLETED'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
          }`}
        >
          {status}
        </span>
      </div>

      {/* Progress Track */}
      <div className="relative pt-2 pb-2">
        <div className="hidden sm:block absolute top-1/2 left-4 right-4 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 relative z-10">
          {FLOW_STEPS.map((step, idx) => {
            const isPassed = !isRejected && !isCancelled && idx < currentIndex;
            const isCurrent = !isRejected && !isCancelled && idx === currentIndex;
            const isUpcoming = !isRejected && !isCancelled && idx > currentIndex;

            return (
              <div
                key={step.key}
                className={`p-2.5 rounded-lg border flex flex-col items-center text-center transition-all ${
                  isCurrent
                    ? 'bg-indigo-900 text-white border-indigo-900 shadow-sm'
                    : isPassed
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-[10px] mb-1.5 ${
                    isCurrent
                      ? 'bg-white text-indigo-900'
                      : isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {isPassed ? '✓' : idx + 1}
                </div>
                <div className={`font-bold text-[11px] truncate w-full ${isCurrent ? 'text-white' : ''}`}>
                  {step.label}
                </div>
                <div className={`text-[9px] mt-0.5 line-clamp-2 leading-tight ${isCurrent ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {step.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rejection notice if application was rejected */}
      {isRejected && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>⛔ Application Not Approved by Credit Committee</span>
            {rejectionDate && (
              <span className="font-mono text-[10px] text-rose-700">
                ({new Date(rejectionDate).toLocaleDateString()})
              </span>
            )}
          </div>
          <p className="text-[11px] leading-relaxed">
            {rejectionReason || 'Underwriting risk profile did not satisfy portfolio institutional thresholds.'}
          </p>
        </div>
      )}

      {/* Revision requested notice */}
      {isRevisionRequested && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>✎ Revision Requested by Underwriting Committee</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            Applicant or loan officer must revise requested terms, upload supplementary documentation, or update guarantor commitments before reconsideration.
          </p>
        </div>
      )}

      {/* Decision Summary Footer */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200 font-mono">
        <div>
          {submittedAt && <span>Submitted: {new Date(submittedAt).toLocaleDateString()}</span>}
        </div>
        <div>
          {approvalDate && <span className="text-emerald-700 font-semibold">Approved: {new Date(approvalDate).toLocaleDateString()}</span>}
          {disbursedAt && <span className="text-slate-700 ml-3 font-semibold">Disbursed: {new Date(disbursedAt).toLocaleDateString()}</span>}
        </div>
      </div>
    </div>
  );
};
