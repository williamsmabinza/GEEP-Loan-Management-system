import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import {
  LoanDTO,
  CustomerDTO,
  PaymentMethod,
  AllocationStrategy,
  OverpaymentRule,
  PaymentTransactionDTO,
  RepaymentScheduleDTO,
} from '../../../shared/types/index.js';
import { formatTZS } from '../../utils/currency.js';
import { useAuth } from '../../context/AuthContext.js';

interface RecordPaymentModalProps {
  initialLoanId?: string;
  onClose: () => void;
  onSuccess: (payment: PaymentTransactionDTO) => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  initialLoanId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Search & Selection State
  const [loanSearch, setLoanSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<LoanDTO | null>(null);

  // Payment Form State
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [allocationStrategy, setAllocationStrategy] = useState<AllocationStrategy>(
    'PENALTIES_FEES_INTEREST_PRINCIPAL'
  );
  const [overpaymentRule, setOverpaymentRule] = useState<OverpaymentRule>(
    'APPLY_TO_NEXT_INSTALLMENTS'
  );
  const [notes, setNotes] = useState('');

  // Live Allocation Preview State
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize data
  useEffect(() => {
    const init = async () => {
      setLoadingInitial(true);
      try {
        const [loansData, custData] = await Promise.all([
          api.loans.getAll(),
          api.customers.getAll(),
        ]);
        setLoans(loansData);
        setCustomers(custData);

        // Pre-generate references
        const now = new Date();
        const rand = Math.floor(10000 + Math.random() * 90000);
        setPaymentReference(`PAY-${now.getFullYear()}-${rand}`);
        setTransactionReference(`TXN-${now.getFullYear()}-${rand}`);

        if (initialLoanId) {
          const matched = loansData.find((l) => l.id === initialLoanId);
          if (matched) {
            setSelectedLoan(matched);
            const nextDue = matched.repayments?.find((r) => r.status !== 'PAID');
            setAmount(nextDue ? nextDue.outstandingAmount || nextDue.totalDue : matched.monthlyInstallment);
          }
        } else if (loansData.length > 0) {
          const activeLoan = loansData.find((l) => l.status === 'ACTIVE') || loansData[0];
          setSelectedLoan(activeLoan);
          const nextDue = activeLoan.repayments?.find((r) => r.status !== 'PAID');
          setAmount(nextDue ? nextDue.outstandingAmount || nextDue.totalDue : activeLoan.monthlyInstallment);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingInitial(false);
      }
    };
    init();
  }, [initialLoanId]);

  // Recalculate Live Allocation Preview
  useEffect(() => {
    if (!selectedLoan || amount <= 0) {
      setPreviewData(null);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await api.payments.previewAllocation({
          loanId: selectedLoan.id,
          amount: Number(amount),
          strategy: allocationStrategy,
          overpaymentRule,
          paymentDate,
        });
        setPreviewData(res);
      } catch (err) {
        console.warn('Preview allocation warning:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedLoan, amount, allocationStrategy, overpaymentRule, paymentDate]);

  // Handle Loan Select
  const handleSelectLoan = (loan: LoanDTO) => {
    setSelectedLoan(loan);
    const nextDue = loan.repayments?.find((r) => r.status !== 'PAID');
    setAmount(nextDue ? nextDue.outstandingAmount || nextDue.totalDue : loan.monthlyInstallment);
    setLoanSearch('');
    setCustomerSearch('');
  };

  // Filtered loans list based on search
  const filteredLoans = loans.filter((l) => {
    if (!loanSearch.trim()) return true;
    const q = loanSearch.toLowerCase();
    const matchNum = l.loanNumber.toLowerCase().includes(q);
    const matchCustName =
      `${l.customer?.firstName || l.borrower?.firstName || ''} ${l.customer?.lastName || l.borrower?.lastName || ''}`
        .toLowerCase()
        .includes(q);
    const matchCustNum = (l.customer?.customerNumber || '').toLowerCase().includes(q);
    return matchNum || matchCustName || matchCustNum;
  });

  // Filtered customers list based on search
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return false;
    const q = customerSearch.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.customerNumber.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) {
      setError('Please select a loan facility.');
      return;
    }
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await api.payments.create({
        loanId: selectedLoan.id,
        amount: Number(amount),
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        transactionReference: transactionReference.trim() || undefined,
        paymentDate,
        allocationStrategy,
        overpaymentRule,
        notes: notes.trim() || undefined,
      });

      onSuccess(result);
    } catch (err) {
      setError((err as Error).message || 'Failed to record repayment settlement');
      setIsSubmitting(false);
    }
  };

  // Find next unpaid installment for selected loan
  const nextInstallment: RepaymentScheduleDTO | undefined = selectedLoan?.repayments?.find(
    (r) => r.status !== 'PAID'
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[95vh] flex flex-col text-xs text-slate-800 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-600 uppercase px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                TELLER CONSOLE
              </span>
              <h3 className="text-base font-bold text-slate-900">
                Record Repayment Settlement & Issue Official Receipt
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Multi-tier priority obligation allocation, partial payments, excess handling, and audited ledger updates.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-2xl leading-none p-1">
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold ml-2 text-rose-700">&times;</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          
          {/* SEARCH FACILITY & CUSTOMER SECTION */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>🔍 Search & Select Target Facility</span>
              {selectedLoan && (
                <span className="font-mono text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Selected: {selectedLoan.loanNumber}
                </span>
              )}
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Search Loan */}
              <div className="relative">
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                  Search Facility (Loan #, Customer, Product)
                </label>
                <input
                  type="text"
                  placeholder="Type loan # or name (e.g. LN-2026 or Hayes)..."
                  value={loanSearch}
                  onChange={(e) => setLoanSearch(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                />

                {loanSearch.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredLoans.slice(0, 5).map((l) => (
                      <div
                        key={l.id}
                        onClick={() => handleSelectLoan(l)}
                        className="p-2.5 hover:bg-indigo-50/70 cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-900">{l.loanNumber}</span>
                          <span className="text-slate-500 block text-[10px]">
                            {l.customer?.firstName || l.borrower?.firstName} {l.customer?.lastName || l.borrower?.lastName} &bull; {l.product?.name}
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-800">{formatTZS(l.remainingBalance)}</span>
                          <span className="text-[10px] text-slate-400 block">{l.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Customer */}
              <div className="relative">
                <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1">
                  Search Borrower Profile (Name, Phone, ID)
                </label>
                <input
                  type="text"
                  placeholder="Type customer phone or name (e.g. Fatma, +255)..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                />

                {customerSearch.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredCustomers.slice(0, 5).map((c) => {
                      const custLoans = loans.filter((l) => l.customerId === c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (custLoans.length > 0) {
                              handleSelectLoan(custLoans[0]);
                            } else {
                              setCustomerSearch('');
                            }
                          }}
                          className="p-2.5 hover:bg-indigo-50/70 cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{c.firstName} {c.lastName}</span>
                            <span className="text-slate-500 block text-[10px] font-mono">
                              {c.customerNumber} &bull; {c.phone}
                            </span>
                          </div>
                          <div className="text-right font-mono text-[10px] text-slate-500">
                            {custLoans.length} Facilities on file
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Facility Financial Snapshot Card */}
            {selectedLoan && (
              <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <div>
                    <span className="font-mono font-bold text-indigo-950 text-xs">
                      {selectedLoan.loanNumber} &bull; {selectedLoan.product?.name}
                    </span>
                    <span className="text-slate-500 block text-[10px]">
                      Borrower: <strong className="text-slate-800">{selectedLoan.customer?.firstName || selectedLoan.borrower?.firstName} {selectedLoan.customer?.lastName || selectedLoan.borrower?.lastName}</strong> ({selectedLoan.customer?.customerNumber || 'CUST-001'})
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    selectedLoan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {selectedLoan.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block">Remaining Balance</span>
                    <span className="font-extrabold text-slate-900">{formatTZS(selectedLoan.remainingBalance)}</span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block">Principal Amount</span>
                    <span className="font-bold text-slate-700">{formatTZS(selectedLoan.principalAmount)}</span>
                  </div>

                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 font-sans block">Total Repaid to Date</span>
                    <span className="font-bold text-emerald-800">{formatTZS(selectedLoan.totalPaidAmount || 0)}</span>
                  </div>

                  <div className="p-2 bg-indigo-50/50 rounded border border-indigo-200">
                    <span className="text-[10px] text-indigo-600 font-sans block font-semibold">Current Installment Due</span>
                    <span className="font-extrabold text-indigo-950">
                      {nextInstallment ? formatTZS(nextInstallment.outstandingAmount || nextInstallment.totalDue) : 'None (Fully Settled)'}
                    </span>
                    {nextInstallment && (
                      <span className="text-[9px] text-slate-400 block font-sans">
                        Due Date: {new Date(nextInstallment.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PAYMENT TRANSACTION DETAILS FORM */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              💵 Settlement Information & Channel Details
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Payment Amount */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Repayment Amount (TZS) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  step={100}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-emerald-800 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />

                {/* Amount shortcut pills */}
                {selectedLoan && (
                  <div className="flex gap-1.5 mt-1.5">
                    {nextInstallment && (
                      <button
                        type="button"
                        onClick={() => setAmount(nextInstallment.outstandingAmount || nextInstallment.totalDue)}
                        className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded text-[10px] font-mono font-semibold"
                      >
                        Pay Current Due ({formatTZS(nextInstallment.outstandingAmount || nextInstallment.totalDue)})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAmount(selectedLoan.remainingBalance)}
                      className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[10px] font-mono font-semibold"
                    >
                      Pay Full Facility ({formatTZS(selectedLoan.remainingBalance)})
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white font-semibold text-xs"
                >
                  <option value="BANK_TRANSFER">🏦 Bank Transfer (EFT / TISS / ACH)</option>
                  <option value="MOBILE_MONEY">📱 Mobile Money (M-Pesa / Tigo / Airtel)</option>
                  <option value="CASH">💵 Cash (Branch Cashier Vault)</option>
                  <option value="CHEQUE">📝 Cheque / Commercial Draft</option>
                  <option value="OTHER">🌐 Other Settlement Channel</option>
                </select>
              </div>

              {/* Value Date */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Payment Effective Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-white text-xs"
                />
              </div>

              {/* Payment Reference */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Payment Reference <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold bg-white text-xs"
                />
              </div>

              {/* Transaction Reference */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Transaction Reference / Bank Slip # <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CRDB-DEP-9921 or MPESA-Q4491"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono bg-white text-xs"
                />
              </div>

              {/* Collected By */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Processed By (Audited Signoff)
                </label>
                <input
                  type="text"
                  disabled
                  value={`${user?.firstName || 'Authorized'} ${user?.lastName || 'Teller'} (${user?.role || 'CASHIER'})`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 font-semibold text-slate-600 text-xs"
                />
              </div>
            </div>
          </div>

          {/* CONFIGURABLE PAYMENT ALLOCATION & OVERPAYMENT RULES */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
            <h5 className="font-bold text-indigo-950 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>⚖️ Configurable Allocation Strategy & Overpayment Business Rules</span>
              <span className="font-mono text-[10px] text-indigo-700">Strict Actuarial Waterfall</span>
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Allocation Strategy */}
              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  Allocation Priority Sequence
                </label>
                <select
                  value={allocationStrategy}
                  onChange={(e) => setAllocationStrategy(e.target.value as AllocationStrategy)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-lg bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="PENALTIES_FEES_INTEREST_PRINCIPAL">
                    1. Penalties &rarr; 2. Fees &rarr; 3. Interest &rarr; 4. Principal (Standard)
                  </option>
                  <option value="FEES_PENALTIES_INTEREST_PRINCIPAL">
                    1. Fees &rarr; 2. Penalties &rarr; 3. Interest &rarr; 4. Principal
                  </option>
                  <option value="INTEREST_FEES_PENALTIES_PRINCIPAL">
                    1. Interest &rarr; 2. Fees &rarr; 3. Penalties &rarr; 4. Principal
                  </option>
                  <option value="PRINCIPAL_FIRST">
                    1. Principal First (Borrower Principal Curtailment Strategy)
                  </option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Controls the order in which funds satisfy delinquent penalties, administrative fees, accrued interest, and facility principal.
                </p>
              </div>

              {/* Overpayment Rule */}
              <div>
                <label className="block text-slate-800 font-bold mb-1">
                  Overpayment Handling Policy
                </label>
                <select
                  value={overpaymentRule}
                  onChange={(e) => setOverpaymentRule(e.target.value as OverpaymentRule)}
                  className="w-full px-3 py-2 border border-indigo-300 rounded-lg bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="APPLY_TO_NEXT_INSTALLMENTS">
                    Apply Excess to Subsequent Scheduled Installments (Advance Waterfall)
                  </option>
                  <option value="REDUCE_OUTSTANDING_PRINCIPAL">
                    Direct Principal Balance Curtailment (Accelerate Payoff)
                  </option>
                  <option value="HOLD_AS_UNALLOCATED_CREDIT">
                    Hold as Unallocated Customer Credit Balance
                  </option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                  Determines behavior when payment amount exceeds currently due obligations.
                </p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-800 font-bold mb-1">
                Cashier Audit Notes & Counter Memo
              </label>
              <input
                type="text"
                placeholder="e.g. Direct customer walk-in settlement, verified branch cash deposit slip #4491..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
              />
            </div>
          </div>

          {/* REAL-TIME ALLOCATION PREVIEW BOX */}
          {previewData && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-2.5 font-mono">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                <span className="font-bold text-emerald-950 text-xs font-sans uppercase">
                  Real-time Allocation Projection Preview
                </span>
                {previewLoading ? (
                  <span className="text-[10px] text-emerald-700 animate-pulse font-sans">
                    Updating Projection...
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded font-bold font-sans">
                    ✓ Balanced Waterfall
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-[10px] text-slate-400 font-sans block">Penalties</span>
                  <span className="font-bold text-slate-900">{formatTZS(previewData.totalPenaltiesAllocated)}</span>
                </div>

                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-[10px] text-slate-400 font-sans block">Fees</span>
                  <span className="font-bold text-slate-900">{formatTZS(previewData.totalFeesAllocated)}</span>
                </div>

                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-[10px] text-slate-400 font-sans block">Interest</span>
                  <span className="font-bold text-slate-900">{formatTZS(previewData.totalInterestAllocated)}</span>
                </div>

                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-[10px] text-slate-400 font-sans block">Principal</span>
                  <span className="font-bold text-emerald-800">{formatTZS(previewData.totalPrincipalAllocated)}</span>
                </div>

                <div className="bg-white p-2 rounded border border-emerald-200">
                  <span className="text-[10px] text-slate-400 font-sans block">Overpayment</span>
                  <span className="font-bold text-indigo-900">{formatTZS(previewData.overpaymentAmount)}</span>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded border border-emerald-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400 font-sans text-[10px] block">New Outstanding Balance</span>
                  <span className="font-extrabold text-slate-900">{formatTZS(previewData.newTotalOutstandingBalance)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-sans text-[10px] block">Projected Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    previewData.loanStatus === 'CLOSED_PAID_OFF'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {previewData.loanStatus}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-mono">
              Total Collecting: <strong className="text-emerald-800 text-xs">{formatTZS(amount)}</strong>
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || amount <= 0 || !selectedLoan}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  'Recording & Allocating...'
                ) : (
                  <>
                    <span>✓</span> Record Payment & Generate Receipt &rarr;
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
