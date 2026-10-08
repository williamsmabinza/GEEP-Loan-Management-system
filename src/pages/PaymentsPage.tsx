import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import {
  PaymentTransactionDTO,
  LoanDTO,
  PaymentReceiptDTO,
} from '../../shared/types/index.js';
import { StatCard } from '../components/common/StatCard.js';
import { formatTZS } from '../utils/currency.js';
import { RecordPaymentModal } from '../components/payment/RecordPaymentModal.js';
import { PaymentReceiptModal } from '../components/payment/PaymentReceiptModal.js';

export const PaymentsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [payments, setPayments] = useState<PaymentTransactionDTO[]>([]);
  const [loans, setLoans] = useState<LoanDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<PaymentReceiptDTO | null>(null);
  const [reverseTarget, setReverseTarget] = useState<PaymentTransactionDTO | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const fetchPaymentsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [paymentsData, loansData] = await Promise.all([
        api.payments.getAll(),
        api.loans.getAll(),
      ]);
      setPayments(paymentsData);
      setLoans(loansData);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch payment ledger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();
  }, []);

  const handleOpenReceipt = async (payment: PaymentTransactionDTO) => {
    try {
      const receipt = await api.payments.getReceipt(payment.id);
      setViewingReceipt(receipt);
    } catch (err) {
      setError((err as Error).message || 'Failed to load receipt');
    }
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseTarget) return;
    setIsReversing(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await api.payments.reverse(reverseTarget.id, reverseReason);
      setSuccessMsg(
        `Transaction ${reverseTarget.paymentReference || reverseTarget.transactionRef} successfully reversed. Reversal entry ${res.reversalTransaction.paymentReference} recorded in ledger.`
      );
      setReverseTarget(null);
      setReverseReason('');
      await fetchPaymentsData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsReversing(false);
    }
  };

  const canCreate = hasPermission('payment.create');
  const canReverse = hasPermission('payment.reverse');

  // Filtered Payments
  const filteredPayments = payments.filter((p) => {
    if (methodFilter !== 'ALL' && p.method !== methodFilter) return false;
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'REVERSED' && p.status !== 'REVERSED') return false;
      if (statusFilter === 'ACTIVE' && p.status === 'REVERSED') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = (p.paymentReference || '').toLowerCase().includes(q);
      const matchTxn = (p.transactionRef || '').toLowerCase().includes(q);
      const matchRcp = (p.receiptNumber || '').toLowerCase().includes(q);
      const matchLoan = (p.loanNumber || p.loanId || '').toLowerCase().includes(q);
      const matchCust = (p.customerName || '').toLowerCase().includes(q);
      return matchRef || matchTxn || matchRcp || matchLoan || matchCust;
    }
    return true;
  });

  const totalCollected = payments
    .filter((p) => p.status !== 'REVERSED' && !p.isReversal)
    .reduce((acc, p) => acc + p.amount, 0);

  const totalReversed = payments
    .filter((p) => p.status === 'REVERSED')
    .reduce((acc, p) => acc + (p.amount > 0 ? p.amount : 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Cashier Desk & Repayment Settlement Ledger
            </h1>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
              CURRENCY: TZS
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Multichannel collection allocations, priority obligation watermarking, teller receipts, and auditable accounting reversals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPaymentsData}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Refresh Ledger
          </button>
          {canCreate && (
            <button
              onClick={() => setShowCollectModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>+</span> Record Payment Settlement
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2 text-rose-700">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-bold ml-2 text-emerald-700">&times;</button>
        </div>
      )}

      {/* Surveillance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Settled Collections"
          value={formatTZS(totalCollected)}
          subtext="Net received & reconciled"
        />
        <StatCard
          label="Settled Vouchers"
          value={payments.filter((p) => p.status !== 'REVERSED' && !p.isReversal).length.toString()}
          subtext="Active clearings"
        />
        <StatCard
          label="Reversed Transactions"
          value={payments.filter((p) => p.status === 'REVERSED').length.toString()}
          subtext={`Reversal volume: ${formatTZS(totalReversed)}`}
        />
        <StatCard
          label="Active Facilities Serviced"
          value={loans.filter((l) => l.status === 'ACTIVE' || l.status === 'DISBURSED').length.toString()}
          subtext="Amortizing credit facilities"
        />
      </div>

      {/* Payments Ledger Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-0">
        
        {/* Table Toolbar */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Reconciled Financial Transaction Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Immutable accounting records with itemized penalty, fee, interest, and principal allocations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <input
              type="text"
              placeholder="Search receipt, payment ref, borrower, facility..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-64 bg-white focus:outline-none"
            />

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
            >
              <option value="ALL">All Methods</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="CASH">Cash Vault</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Settled Active</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/60 text-slate-600 font-bold text-[11px]">
                <th className="py-3 px-4">Receipt & Reference</th>
                <th className="py-3 px-4">Facility & Borrower</th>
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
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading payment records...
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    No payment transactions matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const loan = loans.find((l) => l.id === p.loanId);
                  const isRev = p.status === 'REVERSED' || p.isReversal;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isRev ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">
                          {p.receiptNumber || 'RCP-ON-FILE'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.paymentReference || p.transactionRef}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-slate-900 font-mono text-xs">
                          {p.loanNumber || loan?.loanNumber || 'FACILITY-01'}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-44">
                          {p.customerName || (loan?.customer ? `${loan.customer.firstName} ${loan.customer.lastName}` : 'Valued Client')}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {p.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-sans text-slate-600 text-[11px]">
                        <div>{new Date(p.paymentDate).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Teller: {p.receivedBy ? `${p.receivedBy.firstName} ${p.receivedBy.lastName}` : 'Counter'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-bold text-xs ${
                            p.amount < 0 || isRev ? 'text-rose-700 line-through' : 'text-emerald-800'
                          }`}
                        >
                          {formatTZS(Math.abs(p.amount))}
                        </span>
                        {p.isReversal && (
                          <span className="block text-[9px] text-rose-600 font-sans font-bold uppercase">
                            Reversal Entry
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <div className="flex flex-wrap gap-1 text-[9px] font-mono">
                          {p.principalAllocated !== undefined && p.principalAllocated > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              P: {formatTZS(p.principalAllocated)}
                            </span>
                          )}
                          {p.interestAllocated !== undefined && p.interestAllocated > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                              I: {formatTZS(p.interestAllocated)}
                            </span>
                          )}
                          {p.feesAllocated !== undefined && p.feesAllocated > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                              F: {formatTZS(p.feesAllocated)}
                            </span>
                          )}
                          {p.penaltyAllocated !== undefined && p.penaltyAllocated > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                              Pen: {formatTZS(p.penaltyAllocated)}
                            </span>
                          )}
                          {p.overpaymentAmount !== undefined && p.overpaymentAmount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              Excess: {formatTZS(p.overpaymentAmount)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'FULLY_ALLOCATED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'REVERSED'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenReceipt(p)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-semibold transition-colors shadow-2xs whitespace-nowrap"
                          >
                            Receipt 🖨
                          </button>

                          {canReverse && p.status !== 'REVERSED' && !p.isReversal && (
                            <button
                              type="button"
                              onClick={() => setReverseTarget(p)}
                              className="px-2 py-1 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded text-[11px] font-medium transition-colors whitespace-nowrap"
                            >
                              Reverse
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Collection Modal */}
      {showCollectModal && (
        <RecordPaymentModal
          onClose={() => setShowCollectModal(false)}
          onSuccess={(newPayment) => {
            setShowCollectModal(false);
            setSuccessMsg(`Payment of ${formatTZS(newPayment.amount)} posted and allocated successfully.`);
            fetchPaymentsData();
            if (newPayment.receipt) {
              setViewingReceipt(newPayment.receipt);
            }
          }}
        />
      )}

      {/* Official Payment Receipt Modal */}
      {viewingReceipt && (
        <PaymentReceiptModal
          receipt={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {/* Payment Reversal Modal */}
      {reverseTarget && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white border border-rose-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-rose-900 flex items-center gap-2">
                <span>⚠️</span> Reverse Payment Transaction
              </h3>
              <button
                onClick={() => setReverseTarget(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleReverse} className="space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-lg text-xs leading-relaxed">
                Reversing receipt <strong className="font-mono">{reverseTarget.receiptNumber || reverseTarget.paymentReference}</strong> for amount <strong className="font-mono">{formatTZS(reverseTarget.amount)}</strong> will create an <strong>audited accounting reversal transaction</strong> and restore the facility's outstanding balances.
                <div className="text-[10px] text-slate-500 mt-1">
                  Note: The original financial entry will NOT be deleted, ensuring immutable audit compliance.
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Accounting Reversal Justification (Mandatory) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="e.g. Counter posting error, dishonoured cheque recall, bank clearance discrepancy #448..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setReverseTarget(null)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReversing || reverseReason.trim().length < 5}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {isReversing ? 'Recording Reversal...' : 'Confirm Reversal & Restore Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

