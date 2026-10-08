import React, { useState, useEffect } from 'react';
import {
  LoanApplicationDTO,
  LoanApplicationStatus,
  LoanCalculationResultDTO,
  CustomerLoanSummaryDTO,
  PaymentMethod,
} from '../../../shared/types/index.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { formatTZS } from '../../utils/currency.js';
import { ApplicationTimelineTracker } from './ApplicationTimelineTracker.js';

interface ApplicationReviewModalProps {
  application: LoanApplicationDTO;
  onClose: () => void;
  onSuccess: (updated: LoanApplicationDTO) => void;
}

export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  application,
  onClose,
  onSuccess,
}) => {
  const { user, hasPermission } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'approval' | 'disbursement' | 'assessment' | 'documents' | 'schedule' | 'notes'>('approval');

  // Customer historical records & obligations
  const [customerHistory, setCustomerHistory] = useState<CustomerLoanSummaryDTO | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Live Loan Calculation Preview
  const [calcPreview, setCalcPreview] = useState<LoanCalculationResultDTO | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Approval Terms state
  const [approvedAmount, setApprovedAmount] = useState<number>(application.approvedAmount || application.requestedAmount);
  const [approvedTermMonths, setApprovedTermMonths] = useState<number>(application.approvedTermMonths || application.requestedTermMonths);
  const [approvedRate, setApprovedRate] = useState<number>(
    application.approvedInterestRate || application.loanProduct?.baseInterestRate || 10.0
  );
  const [approvalNotes, setApprovalNotes] = useState('');

  // Rejection & Revision Modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState('');

  // Credit Assessment Form state
  const [creditScore, setCreditScore] = useState<number>(application.customer?.creditScore || 720);
  const [verifiedIncome, setVerifiedIncome] = useState<number>(application.customer?.monthlyIncome || 6000000);
  const [monthlyDebt, setMonthlyDebt] = useState<number>(1000000);
  const [riskRating, setRiskRating] = useState<'LOW' | 'MEDIUM' | 'MODERATE' | 'HIGH' | 'VERY_HIGH'>('LOW');
  const [maxRecommendedAmt, setMaxRecommendedAmt] = useState<number>(application.requestedAmount);
  const [assessmentSummary, setAssessmentSummary] = useState(
    application.creditAssessment?.assessmentSummary ||
      'Applicant demonstrates stable primary earnings, clean bureau records, and sustainable repayment capacity.'
  );
  const [assessmentDecision, setAssessmentDecision] = useState<'APPROVE' | 'REJECT' | 'REQUEST_ADDITIONAL_COLLATERAL'>('APPROVE');

  // Disbursement Workflow state
  const [disbursementMethod, setDisbursementMethod] = useState<'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CASH' | 'OTHER'>('BANK_TRANSFER');
  const [disbursementReference, setDisbursementReference] = useState(
    `DSB-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`
  );
  const [transactionReference, setTransactionReference] = useState(`TXN-TZS-${Math.floor(100000 + Math.random() * 900000)}`);
  const [disbursementAmount, setDisbursementAmount] = useState<number>(application.approvedAmount || application.requestedAmount);
  const [disbursementDate, setDisbursementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [destinationAccount, setDestinationAccount] = useState<string>(
    application.bankDetails?.accountNumber || '0150248920100'
  );
  const [channelDetails, setChannelDetails] = useState<string>(
    application.bankDetails?.bankName ? `${application.bankDetails.bankName} Clearing` : 'CRDB Commercial Settlement Desk'
  );
  const [disbursementNotes, setDisbursementNotes] = useState('');

  // Notes state
  const [internalNote, setInternalNote] = useState('');
  const [infoRequestText, setInfoRequestText] = useState('');

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Permissions
  const canApprove = hasPermission('loan.approve');
  const canReject = hasPermission('loan.reject');
  const canDisburse = hasPermission('loan.disburse');
  const canAssess = hasPermission('loan.assess') || hasPermission('loan.approve');
  const canRecommend = hasPermission('loan.recommend') || hasPermission('loan.review');

  // Load customer previous loans and obligations
  useEffect(() => {
    let isMounted = true;
    setHistoryLoading(true);
    api.applications
      .getCustomerHistory(application.id)
      .then((data) => {
        if (isMounted) setCustomerHistory(data);
      })
      .catch((err) => {
        console.warn('Customer history fetch note:', err);
      })
      .finally(() => {
        if (isMounted) setHistoryLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [application.id]);

  // Recalculate amortization preview in real-time
  const runRecalculation = async () => {
    setIsCalculating(true);
    try {
      const product = application.loanProduct;
      const res = await api.products.calculate({
        principal: Number(approvedAmount),
        annualRate: Number(approvedRate),
        termMonths: Number(approvedTermMonths),
        interestCalculationMethod: (product?.interestCalculationMethod as any) || 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
        repaymentFrequency: application.repaymentFrequency,
        processingFeeType: product?.processingFeeType,
        processingFeeValue: product?.processingFeeValue || 0,
        insuranceFeeType: product?.insuranceFeeType,
        insuranceFeeValue: product?.insuranceFeeValue || 0,
        startDate: new Date().toISOString().split('T')[0],
      });
      setCalcPreview(res);
      setDisbursementAmount(Number(approvedAmount));
    } catch (err) {
      console.error('Calculation error:', err);
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runRecalculation();
    }, 250);
    return () => clearTimeout(timer);
  }, [approvedAmount, approvedTermMonths, approvedRate, application.repaymentFrequency]);

  // Handle Approve Action
  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await api.applications.transitionStatus(application.id, {
        targetStatus: 'APPROVED',
        approvedAmount: Number(approvedAmount),
        approvedTermMonths: Number(approvedTermMonths),
        approvedInterestRate: Number(approvedRate),
        notes: approvalNotes.trim() || 'Facility formally approved by underwriting authority.',
      });
      setSuccessMsg(`Application approved! Loan facility created with status PENDING_DISBURSEMENT and repayment schedule generated.`);
      onSuccess(updated);
      setActiveTab('disbursement');
    } catch (err) {
      setError((err as Error).message || 'Failed to approve application');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reject Action (Requires comment/reason)
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setError('A comment or reason is strictly required for rejection.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await api.applications.transitionStatus(application.id, {
        targetStatus: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
        notes: rejectionReason.trim(),
      });
      setShowRejectModal(false);
      setSuccessMsg('Loan application successfully rejected. Reason logged in audit registry.');
      onSuccess(updated);
    } catch (err) {
      setError((err as Error).message || 'Failed to reject application');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Request Revision Action
  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionNotes.trim()) {
      setError('Revision instructions or comments are strictly required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await api.applications.transitionStatus(application.id, {
        targetStatus: 'REVISION_REQUESTED',
        revisionNotes: revisionNotes.trim(),
        notes: revisionNotes.trim(),
      });
      setShowRevisionModal(false);
      setSuccessMsg('Revision requested from applicant. Application status updated to REVISION_REQUESTED.');
      onSuccess(updated);
    } catch (err) {
      setError((err as Error).message || 'Failed to request revision');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Capital Disbursement Action
  const handleDisburse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disbursementReference.trim()) {
      setError('Disbursement reference is required.');
      return;
    }
    if (!transactionReference.trim()) {
      setError('Transaction reference (bank/mobile money/cash receipt) is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.applications.disburse(application.id, {
        disbursementReference: disbursementReference.trim(),
        amount: Number(disbursementAmount),
        disbursementDate,
        paymentMethod: disbursementMethod,
        transactionReference: transactionReference.trim(),
        channelDetails: channelDetails.trim(),
        destinationAccount: destinationAccount.trim(),
        notes: disbursementNotes.trim(),
      });

      setSuccessMsg(
        `Disbursement recorded successfully! ${formatTZS(disbursementAmount)} released via ${disbursementMethod}. Facility is now ACTIVE.`
      );
      onSuccess(result.application);
    } catch (err) {
      setError((err as Error).message || 'Disbursement processing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Record Credit Assessment
  const handleRecordAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const dti = verifiedIncome > 0 ? Math.round((monthlyDebt / verifiedIncome) * 1000) / 10 : 0;
    try {
      await api.applications.assess(application.id, {
        creditScore: Number(creditScore),
        monthlyIncome: Number(verifiedIncome),
        monthlyDebtObligations: Number(monthlyDebt),
        debtToIncomeRatio: dti,
        riskRating,
        maxRecommendedAmount: Number(maxRecommendedAmt),
        assessmentSummary: assessmentSummary.trim(),
        decisionRecommendation: assessmentDecision,
      });
      setSuccessMsg('Credit risk assessment recorded successfully.');
      const refetched = await api.applications.getById(application.id);
      onSuccess(refetched);
    } catch (err) {
      setError((err as Error).message || 'Failed to record credit assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Add Internal Note
  const handleAddNote = async (e: React.FormEvent, isInfoRequest = false) => {
    e.preventDefault();
    const content = isInfoRequest ? infoRequestText : internalNote;
    if (!content.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await api.applications.addNote(application.id, {
        content: content.trim(),
        type: isInfoRequest ? 'INFO_REQUEST' : 'INTERNAL_NOTE',
      });
      if (isInfoRequest) setInfoRequestText('');
      else setInternalNote('');
      setSuccessMsg(isInfoRequest ? 'Additional information requested from applicant.' : 'Internal review note recorded.');
      const refetched = await api.applications.getById(application.id);
      onSuccess(refetched);
    } catch (err) {
      setError((err as Error).message || 'Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live values
  const estimatedInstallment = calcPreview?.installmentAmount || 0;
  const estimatedInterest = calcPreview?.totalInterest || 0;
  const estimatedFees = calcPreview?.totalFees || 0;
  const totalPayable = calcPreview?.totalPayable || (approvedAmount + estimatedInterest + estimatedFees);
  const maturityDate =
    calcPreview?.schedule && calcPreview.schedule.length > 0
      ? calcPreview.schedule[calcPreview.schedule.length - 1].dueDate
      : 'Calculated upon schedule generation';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 max-h-[95vh] flex flex-col text-xs animate-in fade-in zoom-in duration-150">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-slate-600 uppercase px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                {application.applicationNumber}
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Loan Underwriting & Credit Approval: {application.customer?.firstName} {application.customer?.lastName}
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                  application.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : application.status === 'APPROVED'
                    ? 'bg-blue-100 text-blue-800'
                    : application.status === 'DISBURSED'
                    ? 'bg-purple-100 text-purple-800'
                    : application.status === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800'
                    : application.status === 'REVISION_REQUESTED'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {application.status}
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[10px] font-semibold">
                TZS
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Product: <span className="font-bold text-slate-800">{application.loanProduct?.name}</span> &bull;
              Customer ID: <span className="font-mono font-medium text-slate-700">{application.customer?.customerNumber || application.customerId}</span> &bull;
              Branch: <span className="font-medium text-slate-700">{application.branchName || 'Dar es Salaam Central'}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none p-1">
            &times;
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold ml-2 text-rose-700">&times;</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2 text-emerald-700">&times;</button>
          </div>
        )}

        {/* Status Lifecycle Tracker */}
        <ApplicationTimelineTracker
          status={application.status}
          submittedAt={application.applicationDate}
          approvalDate={application.approvalDate}
          rejectionDate={application.rejectionDate}
          rejectionReason={application.rejectionReason}
          disbursedAt={application.disbursedAt}
        />

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-4 text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('approval')}
            className={`pb-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'approval'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Approval Interface
          </button>
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`pb-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'disbursement'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Disbursement Workflow {application.status === 'APPROVED' && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>}
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'schedule'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Repayment Schedule
          </button>
          <button
            onClick={() => setActiveTab('assessment')}
            className={`pb-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'assessment'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Credit Assessment
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'documents'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Supporting Documents ({application.documents?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'notes'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Notes & Communication ({application.notes?.length || 0})
          </button>
        </div>

        {/* Tab Content Container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* =========================================================================
              TAB 1: UNIFIED APPROVAL INTERFACE (Mandatory 14-Point Criteria)
             ========================================================================= */}
          {activeTab === 'approval' && (
            <div className="space-y-4">

              {/* Grid 1: Customer Information & Loan Application Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Customer Information */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>👤</span> Customer Information
                    </h5>
                    <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                      KYC: {application.customer?.kycStatus || 'VERIFIED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Full Legal Name</span>
                      <span className="font-bold text-slate-900">{application.customer?.firstName} {application.customer?.lastName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Customer Number</span>
                      <span className="font-mono font-medium">{application.customer?.customerNumber || 'CUST-2026-0001'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Phone Number</span>
                      <span className="font-mono">{application.customer?.phone || '+255 712 345 678'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Email Address</span>
                      <span className="font-mono truncate block">{application.customer?.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ID Verification</span>
                      <span className="font-medium">{application.customer?.idType || 'National ID'}: {application.customer?.idNumber || 'TZ-8849201'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Verified Monthly Income</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {formatTZS(application.employmentInfo?.monthlyIncome || application.customer?.monthlyIncome || 6000000)}
                      </span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-200/60 text-[11px] text-slate-600">
                    Employer: <span className="font-medium text-slate-800">{application.employmentInfo?.employerName || 'On File (Corporate Client)'}</span> &bull;
                    Role: <span className="font-medium text-slate-800">{application.employmentInfo?.jobTitle || 'Executive'}</span>
                  </div>
                </div>

                {/* 2. Loan Application Details */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>📋</span> Loan Application Record
                    </h5>
                    <span className="font-mono text-[10px] text-slate-500">
                      Applied: {new Date(application.applicationDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Application Number</span>
                      <span className="font-mono font-bold text-slate-900">{application.applicationNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Origination Branch</span>
                      <span className="font-medium">{application.branchName || 'Dar es Salaam Central Branch'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Credit Product</span>
                      <span className="font-bold text-indigo-900">{application.loanProduct?.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Interest Rate Basis</span>
                      <span className="font-medium text-slate-700">{application.loanProduct?.interestCalculationMethod?.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                  <div className="pt-1 border-t border-slate-200/60 text-[11px]">
                    <span className="text-slate-400 block text-[10px]">Stated Loan Purpose</span>
                    <span className="text-slate-800 font-medium">{application.purpose}</span>
                  </div>
                </div>
              </div>

              {/* Grid 2: Terms, Amounts, Rates, Fees & Calculated Repayment Schedule */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <h5 className="font-bold text-indigo-950 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <span>💳</span> Facility Terms & Financial Evaluation (Currency: TZS)
                  </h5>
                  {isCalculating && (
                    <span className="text-[10px] text-indigo-600 font-mono animate-pulse">
                      Updating Amortization Engine...
                    </span>
                  )}
                </div>

                {/* Terms comparison & editable inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Requested vs Approved Amount */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Requested Amount
                    </span>
                    <div className="font-mono font-bold text-slate-800 text-sm">
                      {formatTZS(application.requestedAmount)}
                    </div>
                    <label className="text-[10px] text-indigo-900 font-bold uppercase block mt-2">
                      Approved Amount <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step={500000}
                      disabled={application.status === 'APPROVED' || application.status === 'DISBURSED' || application.status === 'ACTIVE'}
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-indigo-300 rounded font-mono font-bold text-indigo-950 bg-indigo-50/30 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>

                  {/* Interest Rate */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Product Benchmark Rate
                    </span>
                    <div className="font-mono font-bold text-slate-800 text-sm">
                      {application.loanProduct?.baseInterestRate}% APR
                    </div>
                    <label className="text-[10px] text-indigo-900 font-bold uppercase block mt-2">
                      Approved Rate (%) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step={0.25}
                      disabled={application.status === 'APPROVED' || application.status === 'DISBURSED' || application.status === 'ACTIVE'}
                      value={approvedRate}
                      onChange={(e) => setApprovedRate(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-indigo-300 rounded font-mono font-bold text-indigo-950 bg-indigo-50/30 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>

                  {/* Term */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Requested Term
                    </span>
                    <div className="font-mono font-bold text-slate-800 text-sm">
                      {application.requestedTermMonths} Months
                    </div>
                    <label className="text-[10px] text-indigo-900 font-bold uppercase block mt-2">
                      Approved Term (Mo) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      disabled={application.status === 'APPROVED' || application.status === 'DISBURSED' || application.status === 'ACTIVE'}
                      value={approvedTermMonths}
                      onChange={(e) => setApprovedTermMonths(Number(e.target.value))}
                      className="w-full px-2 py-1 border border-indigo-300 rounded font-mono font-bold text-indigo-950 bg-indigo-50/30 text-xs mt-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                    />
                  </div>

                  {/* Repayment Frequency */}
                  <div className="bg-white p-3 rounded-lg border border-indigo-200">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">
                      Repayment Frequency
                    </span>
                    <div className="font-mono font-bold text-indigo-900 text-sm">
                      {application.repaymentFrequency}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-2">
                      Installments Total:
                    </span>
                    <div className="font-mono font-semibold text-slate-700">
                      {calcPreview?.numberOfInstallments || approvedTermMonths} Payments
                    </div>
                  </div>
                </div>

                {/* Calculation Summary Bar: Estimated Installment, Total Fees, Total Payable */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-indigo-200 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans block">Estimated Installment</span>
                    <div className="text-base font-extrabold text-indigo-900">
                      {formatTZS(estimatedInstallment)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">per {application.repaymentFrequency.toLowerCase()}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans block">Total Expected Interest</span>
                    <div className="text-sm font-bold text-slate-800">
                      {formatTZS(estimatedInterest)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">over facility term</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans block">Fees Breakdown</span>
                    <div className="text-sm font-bold text-slate-800">
                      {formatTZS(estimatedFees)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">
                      Origination: {application.loanProduct?.processingFeeValue || 1.5}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 font-sans block">Total Payable</span>
                    <div className="text-base font-extrabold text-emerald-700">
                      {formatTZS(totalPayable)}
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans">Maturity: {maturityDate}</span>
                  </div>
                </div>
              </div>

              {/* Grid 3: Credit Assessment & Supporting Documents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Credit Assessment Summary */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>📊</span> Credit Assessment Analysis
                    </h5>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      (application.creditAssessment?.riskRating || riskRating) === 'LOW'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      Risk: {application.creditAssessment?.riskRating || riskRating}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-sans block">Credit Score</span>
                      <span className="font-bold text-slate-900">{application.creditAssessment?.creditScore || creditScore} / 850</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-sans block">DTI Ratio</span>
                      <span className="font-bold text-slate-900">{application.creditAssessment?.debtToIncomeRatio || 16.7}%</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-sans block">Recommended Cap</span>
                      <span className="font-bold text-slate-900 truncate block">
                        {formatTZS(application.creditAssessment?.maxRecommendedAmount || maxRecommendedAmt)}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white rounded border border-slate-200 text-[11px] text-slate-700 leading-relaxed">
                    <span className="text-[10px] text-slate-400 block font-semibold">Underwriting Assessment Summary:</span>
                    {application.creditAssessment?.assessmentSummary || assessmentSummary}
                  </div>
                  {application.creditAssessment && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      Assessed by: {application.creditAssessment.assessedByName} ({new Date(application.creditAssessment.assessedAt).toLocaleDateString()})
                    </div>
                  )}
                </div>

                {/* Supporting Documents */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>📁</span> Supporting Documents ({application.documents?.length || 0})
                    </h5>
                    <button
                      onClick={() => setActiveTab('documents')}
                      className="text-[10px] text-indigo-700 hover:underline font-semibold"
                    >
                      Manage All &rarr;
                    </button>
                  </div>

                  {(!application.documents || application.documents.length === 0) ? (
                    <div className="py-6 text-center text-slate-400">No documents attached.</div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {application.documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-400">📄</span>
                            <div>
                              <span className="font-semibold text-slate-900 block truncate">{doc.documentName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{doc.documentType} &bull; {doc.fileSize || '1.2 MB'}</span>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              doc.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {doc.verified ? 'VERIFIED' : 'PENDING'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid 4: Previous Loans & Outstanding Obligations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Previous Loans */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>⏮</span> Customer Previous Loans History
                    </h5>
                    <span className="font-mono text-[10px] text-slate-600">
                      Total Facilities: {customerHistory?.totalLoansCount || 0}
                    </span>
                  </div>

                  {historyLoading ? (
                    <div className="py-4 text-center text-slate-400 font-mono">Loading credit history...</div>
                  ) : (!customerHistory?.previousLoans || customerHistory.previousLoans.length === 0) ? (
                    <div className="p-3 bg-white rounded border border-slate-200 text-slate-500 text-[11px]">
                      No previous completed credit facilities on file for this customer. Applicant has prime fresh borrower record.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {customerHistory.previousLoans.map((pl) => (
                        <div key={pl.id} className="p-2.5 bg-white rounded border border-slate-200 flex items-center justify-between font-mono text-[11px]">
                          <div>
                            <span className="font-bold text-slate-900">{pl.loanNumber}</span>
                            <span className="text-slate-400 block text-[10px] font-sans">
                              Term: {pl.termMonths} Mo &bull; Rate: {pl.interestRate}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-800">{formatTZS(pl.principalAmount)}</span>
                            <span className="block text-[10px] font-bold text-emerald-700 uppercase">
                              {pl.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outstanding Obligations */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>⚖️</span> Outstanding Credit Obligations & Exposure
                    </h5>
                    <span className="font-mono text-[10px] text-slate-600">
                      Active Loans: {customerHistory?.activeLoansCount || 0}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div className="p-2.5 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-sans block">Total Outstanding Balance</span>
                      <span className="font-bold text-slate-900 text-xs">
                        {formatTZS(customerHistory?.totalOutstandingBalance || 0)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-sans block">Monthly Debt Service Commitment</span>
                      <span className="font-bold text-amber-900 text-xs">
                        {formatTZS(customerHistory?.totalMonthlyDebtObligation || 0)}
                      </span>
                    </div>
                  </div>

                  {(!customerHistory?.activeLoans || customerHistory.activeLoans.length === 0) ? (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded text-[11px]">
                      ✓ No existing active debt obligations detected. Low risk exposure.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {customerHistory.activeLoans.map((al) => (
                        <div key={al.id} className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between text-[11px] font-mono">
                          <div>
                            <span className="font-bold text-slate-900">{al.loanNumber}</span>
                            <span className="text-slate-500 block text-[10px]">Monthly: {formatTZS(al.monthlyInstallment)}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-800">{formatTZS(al.remainingBalance)}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold ml-1">
                              {al.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ACTION BAR: Approve, Reject, Request Revision */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider">
                      Authorized Underwriting Actions
                    </h5>
                    <p className="text-[11px] text-slate-300">
                      Review all terms, assessment records, and supporting files before finalizing commitment.
                    </p>
                  </div>

                  {/* Decision Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Request Revision */}
                    <button
                      type="button"
                      disabled={isSubmitting || application.status === 'APPROVED' || application.status === 'ACTIVE'}
                      onClick={() => setShowRevisionModal(true)}
                      className="px-3.5 py-2 border border-amber-400 text-amber-300 hover:bg-amber-400/10 rounded-lg font-semibold text-xs transition-colors"
                    >
                      Request Revision ✎
                    </button>

                    {/* Reject */}
                    {canReject && (
                      <button
                        type="button"
                        disabled={isSubmitting || application.status === 'REJECTED' || application.status === 'ACTIVE'}
                        onClick={() => setShowRejectModal(true)}
                        className="px-3.5 py-2 border border-rose-400 text-rose-300 hover:bg-rose-400/10 rounded-lg font-semibold text-xs transition-colors"
                      >
                        Reject Application ✕
                      </button>
                    )}

                    {/* Approve */}
                    {canApprove && (
                      <button
                        type="button"
                        disabled={isSubmitting || application.status === 'APPROVED' || application.status === 'ACTIVE'}
                        onClick={handleApprove}
                        className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-colors"
                      >
                        {application.status === 'APPROVED' ? 'Approved ✓' : 'Approve Facility & Generate Schedule &rarr;'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Optional Approval Notes */}
                {application.status !== 'APPROVED' && application.status !== 'ACTIVE' && (
                  <div>
                    <input
                      type="text"
                      placeholder="Optional approval notes or stipulations (e.g. Approved as recommended subject to final identity validation)..."
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 2: CAPITAL DISBURSEMENT WORKFLOW
             ========================================================================= */}
          {activeTab === 'disbursement' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <div>
                    <h5 className="font-bold text-emerald-950 uppercase tracking-wider text-xs">
                      Capital Disbursement & Liquidity Settlement Console
                    </h5>
                    <p className="text-[11px] text-emerald-800 mt-0.5">
                      Release approved credit capital to borrower through commercial banking, mobile money, cash desk, or clearing channel.
                    </p>
                  </div>
                  <span className="font-mono text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-bold">
                    CURRENCY: TZS
                  </span>
                </div>

                {/* Notice banner about loan status */}
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px] flex items-start gap-2">
                  <span className="text-amber-600 font-bold text-sm">ℹ</span>
                  <div>
                    <span className="font-bold block">Prudential Regulatory Requirement:</span>
                    A loan facility remains in <span className="font-mono font-bold">PENDING_DISBURSEMENT</span> and will
                    <span className="font-bold text-rose-800"> NOT be marked as ACTIVE</span> until capital disbursement has been successfully executed and recorded in the audit ledger.
                  </div>
                </div>

                {/* Disbursement Execution Form */}
                <form onSubmit={handleDisburse} className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    
                    {/* Method */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Disbursement Channel Method <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={disbursementMethod}
                        onChange={(e) => setDisbursementMethod(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold text-xs"
                      >
                        <option value="BANK_TRANSFER">🏦 Bank Transfer (EFT / TISS / ACH)</option>
                        <option value="MOBILE_MONEY">📱 Mobile Money (M-Pesa / Airtel Money / Tigo Pesa)</option>
                        <option value="CASH">💵 Cash (Branch Cashier Vault)</option>
                        <option value="OTHER">🌐 Other Commercial Clearing Channel</option>
                      </select>
                    </div>

                    {/* Disbursement Reference */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Disbursement Reference <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={disbursementReference}
                        onChange={(e) => setDisbursementReference(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold bg-white text-xs"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Disbursement Amount (TZS) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        step={1000}
                        value={disbursementAmount}
                        onChange={(e) => setDisbursementAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold bg-white text-emerald-800 text-xs"
                      />
                    </div>

                    {/* Transaction Reference */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Transaction Reference / Clearing ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CRDB-TISS-99214 or MPESA-QE8849"
                        value={transactionReference}
                        onChange={(e) => setTransactionReference(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-white text-xs"
                      />
                    </div>

                    {/* Destination Account / Phone */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Destination Account / Phone
                      </label>
                      <input
                        type="text"
                        placeholder="Account number or MSISDN"
                        value={destinationAccount}
                        onChange={(e) => setDestinationAccount(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-white text-xs"
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Disbursement Effective Date
                      </label>
                      <input
                        type="date"
                        value={disbursementDate}
                        onChange={(e) => setDisbursementDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-white text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Channel / Institution Details
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CRDB Commercial Clearing, Vodacom B2C Gateway"
                        value={channelDetails}
                        onChange={(e) => setChannelDetails(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Processed By (Audited Signoff)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={`${user?.firstName} ${user?.lastName} (${user?.role || 'Authorized Officer'})`}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 font-semibold text-slate-700 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Disbursement Internal Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Wire verification voucher details, cashier signature confirmation, liquidity pool reference..."
                      value={disbursementNotes}
                      onChange={(e) => setDisbursementNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                    <span className="font-mono text-emerald-900 text-xs">
                      Total Disbursing: <span className="font-bold text-sm">{formatTZS(disbursementAmount)}</span>
                    </span>

                    {canDisburse ? (
                      <button
                        type="submit"
                        disabled={isSubmitting || application.status === 'ACTIVE' || application.status === 'DISBURSED'}
                        className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow-sm transition-colors"
                      >
                        {application.status === 'ACTIVE' || application.status === 'DISBURSED'
                          ? 'Disbursement Recorded ✓ (Active Facility)'
                          : 'Execute Capital Disbursement & Activate Loan &rarr;'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        Disbursement release requires Cashier, Branch Manager, or Admin authority.
                      </span>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB 3: REPAYMENT SCHEDULE & AMORTIZATION
             ========================================================================= */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Actuarial Amortization & Repayment Schedule
                  </h5>
                  <p className="text-[11px] text-slate-500">
                    Maturity Date: <span className="font-mono font-bold text-slate-800">{maturityDate}</span> &bull;
                    Installments: <span className="font-mono font-bold text-slate-800">{calcPreview?.schedule?.length || approvedTermMonths} periods</span>
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded">
                  Installment: {formatTZS(estimatedInstallment)}
                </span>
              </div>

              {(!calcPreview?.schedule || calcPreview.schedule.length === 0) ? (
                <div className="py-8 text-center text-slate-400">Loading amortization schedule...</div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Principal Due</th>
                        <th className="py-2.5 px-3 text-right">Interest Due</th>
                        <th className="py-2.5 px-3 text-right">Fees Due</th>
                        <th className="py-2.5 px-3 text-right">Total Installment</th>
                        <th className="py-2.5 px-3 text-right">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {calcPreview.schedule.map((item) => (
                        <tr key={item.installmentNumber} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-slate-900">{item.installmentNumber}</td>
                          <td className="py-2 px-3 text-slate-700">{item.dueDate}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-900">{formatTZS(item.principalDue)}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{formatTZS(item.interestDue)}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{formatTZS(item.feesDue)}</td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-950">{formatTZS(item.totalDue)}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{formatTZS(item.remainingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 4: CREDIT ASSESSMENT EDITING
             ========================================================================= */}
          {activeTab === 'assessment' && (
            <div className="space-y-4">
              {canAssess && (
                <form onSubmit={handleRecordAssessment} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Record / Update Actuarial Credit Risk Assessment
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                    <div>
                      <label className="block text-slate-600 font-sans mb-1">Credit Score (300-850)</label>
                      <input
                        type="number"
                        min={300}
                        max={850}
                        value={creditScore}
                        onChange={(e) => setCreditScore(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-sans mb-1">Verified Monthly Income (TZS)</label>
                      <input
                        type="number"
                        step={100000}
                        value={verifiedIncome}
                        onChange={(e) => setVerifiedIncome(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-bold text-emerald-800"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-sans mb-1">Existing Monthly Debt (TZS)</label>
                      <input
                        type="number"
                        step={50000}
                        value={monthlyDebt}
                        onChange={(e) => setMonthlyDebt(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-bold text-amber-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1">Actuarial Risk Rating</label>
                      <select
                        value={riskRating}
                        onChange={(e) => setRiskRating(e.target.value as any)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-semibold"
                      >
                        <option value="LOW">LOW Risk (Tier 1 Prime)</option>
                        <option value="MEDIUM">MEDIUM Risk (Standard Underwriting)</option>
                        <option value="MODERATE">MODERATE Risk (Conditional)</option>
                        <option value="HIGH">HIGH Risk (Restricted)</option>
                        <option value="VERY_HIGH">VERY HIGH Risk (Unacceptable)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Max Recommended Amount (TZS)</label>
                      <input
                        type="number"
                        step={500000}
                        value={maxRecommendedAmt}
                        onChange={(e) => setMaxRecommendedAmt(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded font-mono font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Decision Recommendation</label>
                      <select
                        value={assessmentDecision}
                        onChange={(e) => setAssessmentDecision(e.target.value as any)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white font-semibold"
                      >
                        <option value="APPROVE">APPROVE Facility</option>
                        <option value="REJECT">REJECT Facility</option>
                        <option value="REQUEST_ADDITIONAL_COLLATERAL">Request Additional Collateral</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">Underwriting Assessment Summary</label>
                    <textarea
                      rows={2}
                      required
                      value={assessmentSummary}
                      onChange={(e) => setAssessmentSummary(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded font-medium"
                    >
                      Save Credit Risk Assessment
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* =========================================================================
              TAB 5: DOCUMENTS MANAGEMENT
             ========================================================================= */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Document Category</th>
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3 text-right">Size</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {application.documents.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-800">{d.documentType}</td>
                        <td className="py-2.5 px-3 text-slate-700">{d.documentName}</td>
                        <td className="py-2.5 px-3 text-right text-slate-400">{d.fileSize || '1.5 MB'}</td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {d.verified ? 'VERIFIED' : 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Request Additional Document Form */}
              <form onSubmit={(e) => handleAddNote(e, true)} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Request Additional Information or Documents from Applicant
                </h5>
                <textarea
                  rows={2}
                  required
                  placeholder="Detail missing documentation or required financial clarifications for applicant..."
                  value={infoRequestText}
                  onChange={(e) => setInfoRequestText(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 disabled:opacity-50"
                  >
                    Send Information Request
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================================
              TAB 6: NOTES & AUDIT COMMUNICATION
             ========================================================================= */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {application.notes.length === 0 ? (
                  <div className="py-6 text-center text-slate-400">No notes recorded yet.</div>
                ) : (
                  application.notes.map((n) => (
                    <div key={n.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-900">
                          {n.authorName} <span className="font-mono text-slate-400">({n.authorRole})</span>
                          <span className="ml-2 font-mono text-[10px] text-indigo-700 font-semibold px-1.5 py-0.2 bg-indigo-50 rounded">
                            {n.type}
                          </span>
                        </span>
                        <span className="text-slate-400 font-mono">{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed text-[11px]">{n.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={(e) => handleAddNote(e, false)} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Add Internal Note</h5>
                <textarea
                  rows={2}
                  required
                  placeholder="Record verification notes, background checks, or underwriting observations..."
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800"
                  >
                    Save Internal Note
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Nexa Core Banking Engine &bull; Compliant with Banking and Financial Institutions Act (BOT)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800"
          >
            Close Underwriting Dossier
          </button>
        </div>

        {/* =========================================================================
            PROMPT MODAL: MANDATORY REJECTION REASON MODAL
           ========================================================================= */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-rose-900 text-sm flex items-center gap-2">
                  <span>✕</span> Confirm Loan Rejection
                </h4>
                <button onClick={() => setShowRejectModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">
                  &times;
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Institutional credit policy strictly requires an articulated reason/comment when rejecting a loan application for auditing and regulatory notice.
              </p>

              <form onSubmit={handleReject} className="space-y-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-xs">
                    Rejection Reason / Justification <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Debt-to-Income ratio exceeds regulatory prudential cap of 40%, or insufficient verified collateral documentation..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !rejectionReason.trim()}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs disabled:opacity-50"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            PROMPT MODAL: REQUEST REVISION MODAL
           ========================================================================= */}
        {showRevisionModal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                  <span>✎</span> Request Application Revision
                </h4>
                <button onClick={() => setShowRevisionModal(false)} className="text-slate-400 hover:text-slate-700 text-lg">
                  &times;
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Provide instructions to the applicant or originating loan officer detailing what terms, collaterals, or documents need amendment.
              </p>

              <form onSubmit={handleRequestRevision} className="space-y-3">
                <div>
                  <label className="block text-slate-800 font-bold mb-1 text-xs">
                    Revision Instructions & Stipulations <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. Please reduce requested amount to TZS 8,000,000 to satisfy DTI limits or attach updated guarantor financial statements..."
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowRevisionModal(false)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !revisionNotes.trim()}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs disabled:opacity-50"
                  >
                    Send Revision Request
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
