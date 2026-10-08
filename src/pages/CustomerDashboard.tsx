import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { LoanDTO, LoanProductDTO, LoanApplicationDTO } from '../../shared/types/index.js';
import { StatCard } from '../components/common/StatCard.js';
import { StatusIndicator } from '../components/common/StatusIndicator.js';
import { LoanCalculatorWidget } from '../components/loan/LoanCalculatorWidget.js';
import { LoanApplicationWizardModal } from '../components/loan/LoanApplicationWizardModal.js';
import { ApplicationDetailsModal } from '../components/loan/ApplicationDetailsModal.js';
import { formatTZS } from '../utils/currency.js';

export const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanDTO[]>([]);
  const [applications, setApplications] = useState<LoanApplicationDTO[]>([]);
  const [products, setProducts] = useState<LoanProductDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [showApplyWizard, setShowApplyWizard] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<LoanApplicationDTO | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<LoanDTO | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'ACH' | 'WIRE_TRANSFER' | 'DEBIT_CARD'>('ACH');
  const [isPaying, setIsPaying] = useState(false);

  const fetchCustomerData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [loansData, productsData, applicationsData] = await Promise.all([
        api.loans.getAll(),
        api.loans.getProducts(),
        api.applications.getAll(),
      ]);
      setLoans(loansData);
      setProducts(productsData);
      setApplications(applicationsData);
    } catch (err) {
      setError((err as Error).message || 'Failed to load borrower records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const handleMakePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || paymentAmount <= 0) return;
    setIsPaying(true);

    try {
      await api.loans.recordPayment(selectedLoan.id, {
        amount: paymentAmount,
        method: paymentMethod,
        notes: `Online borrower portal settlement via ${paymentMethod}`,
      });
      setShowPaymentModal(false);
      await fetchCustomerData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsPaying(false);
    }
  };

  // Metrics in TZS
  const activeLoans = loans.filter((l) => l.status === 'ACTIVE' || l.status === 'DISBURSED');
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + l.remainingBalance, 0);
  const nextPaymentSum = activeLoans.reduce((sum, l) => sum + l.monthlyInstallment, 0);

  return (
    <div className="space-y-8">
      {/* Header and Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Commercial Borrower Portal
            </h1>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
              TZS SHILLING SETTLEMENT
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Account Holder: <span className="font-medium text-slate-700">{user?.firstName} {user?.lastName}</span> · ID: <span className="font-mono">{user?.nationalId || 'VERIFIED-01'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCalculatorModal(true)}
            className="px-3.5 py-2 border border-slate-300 text-slate-700 bg-white rounded text-xs font-medium hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs flex items-center gap-1.5"
          >
            <span>🧮</span>
            <span>Loan Calculator</span>
          </button>
          <button
            onClick={() => setShowApplyWizard(true)}
            className="px-4 py-2 bg-indigo-900 text-white rounded text-xs font-medium hover:bg-indigo-800 transition-colors whitespace-nowrap shadow-sm"
          >
            + Apply for New Facility (TZS)
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
          {error}
        </div>
      )}

      {/* Financial Facility Metrics Grid (TZS) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Outstanding Balance"
          value={formatTZS(totalOutstanding)}
          subtext="Active institutional capital"
        />
        <StatCard
          label="Next Monthly Installment"
          value={formatTZS(nextPaymentSum)}
          subtext="Auto-debit scheduled"
        />
        <StatCard
          label="Credit Assessment Score"
          value={user?.customer?.creditScore || 745}
          subtext="Tier 1 Institutional Rating"
        />
        <StatCard
          label="Origination Pipeline"
          value={`${applications.length} Applications`}
          subtext={`${applications.filter((a) => a.status === 'UNDER_REVIEW' || a.status === 'CREDIT_ASSESSMENT').length} in underwriting queue`}
        />
      </div>

      {/* Section 1: Loan Applications & Origination Pipeline Tracking */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Loan Applications & Underwriting Pipeline
            </h2>
            <p className="text-xs text-slate-500">
              Real-time multi-stage status tracker from submission to disbursement
            </p>
          </div>
          <button
            onClick={() => setShowApplyWizard(true)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium"
          >
            + New Application
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs space-y-2">
            <p className="font-medium text-slate-800">No active or historical loan applications on file.</p>
            <p className="text-[11px] text-slate-400">Click below to start an institutional credit application in TZS.</p>
            <button
              onClick={() => setShowApplyWizard(true)}
              className="px-3.5 py-1.5 bg-slate-900 text-white rounded text-xs mt-2"
            >
              Start Application
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-3 px-6">App Reference #</th>
                  <th className="py-3 px-6">Product Facility</th>
                  <th className="py-3 px-6 text-right">Requested Capital</th>
                  <th className="py-3 px-6 text-right">Tenor</th>
                  <th className="py-3 px-6">Application Date</th>
                  <th className="py-3 px-6 text-center">Pipeline Stage</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-6 font-bold text-slate-900">
                      {app.applicationNumber}
                    </td>
                    <td className="py-3 px-6 font-sans text-slate-800 font-medium">
                      {app.loanProduct?.name || 'Commercial Credit'}
                    </td>
                    <td className="py-3 px-6 text-right font-bold text-indigo-950">
                      {formatTZS(app.requestedAmount)}
                    </td>
                    <td className="py-3 px-6 text-right text-slate-600">
                      {app.requestedTermMonths} Mo
                    </td>
                    <td className="py-3 px-6 text-slate-600">
                      {new Date(app.applicationDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-6 text-center font-sans">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          app.status === 'APPROVED' || app.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : app.status === 'CREDIT_ASSESSMENT'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {app.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right font-sans">
                      <button
                        onClick={() => setSelectedApplication(app)}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-semibold text-[11px] shadow-2xs"
                      >
                        Track Status &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Active Loan Facilities & Master Servicing */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Active Facilities & Servicing</h2>
            <p className="text-xs text-slate-500">Live amortized credit facilities under management</p>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">{loans.length} active facilities</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading credit records...
          </div>
        ) : loans.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs">
            No active loan facilities currently servicing.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-3 px-6">Facility #</th>
                  <th className="py-3 px-6">Product</th>
                  <th className="py-3 px-6 text-right">Principal</th>
                  <th className="py-3 px-6 text-right">APR</th>
                  <th className="py-3 px-6 text-right">Monthly Due</th>
                  <th className="py-3 px-6 text-right">Remaining Balance</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-6 font-mono font-medium text-slate-900">{loan.loanNumber}</td>
                    <td className="py-3 px-6 text-slate-700">{loan.product?.name || 'Commercial Line'}</td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums">
                      {formatTZS(loan.principalAmount)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums">{loan.interestRate}%</td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums">
                      {formatTZS(loan.monthlyInstallment)}
                    </td>
                    <td className="py-3 px-6 text-right font-mono tabular-nums font-medium text-slate-900">
                      {formatTZS(loan.remainingBalance)}
                    </td>
                    <td className="py-3 px-6">
                      <StatusIndicator status={loan.status} />
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedLoan(loan);
                            setShowScheduleModal(true);
                          }}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded text-xs font-medium"
                        >
                          Schedule
                        </button>
                        {loan.remainingBalance > 0 && (
                          <button
                            onClick={() => {
                              setSelectedLoan(loan);
                              setPaymentAmount(loan.monthlyInstallment);
                              setShowPaymentModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800"
                          >
                            Pay Installment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Repayment Modal */}
      {showPaymentModal && selectedLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Post Installment Payment</h3>
                <p className="text-[11px] text-slate-500 font-mono">Facility: {selectedLoan.loanNumber}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                ✕
              </button>
            </div>

            <form onSubmit={handleMakePayment} className="space-y-4">
              <div>
                <label className="block font-medium text-slate-700 uppercase tracking-wide">
                  Payment Amount (TZS)
                </label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  max={selectedLoan.remainingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                />
                <span className="text-[10px] text-slate-400">
                  Total Remaining Balance: {formatTZS(selectedLoan.remainingBalance)}
                </span>
              </div>

              <div>
                <label className="block font-medium text-slate-700 uppercase tracking-wide">
                  Settlement Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                >
                  <option value="ACH">ACH Direct Debit (Preferred)</option>
                  <option value="WIRE_TRANSFER">TISS / Institutional Bank Wire</option>
                  <option value="DEBIT_CARD">Tanzanian Mobile Money / Visa</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {isPaying ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Schedule Modal */}
      {showScheduleModal && selectedLoan && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Repayment Amortization Schedule</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedLoan.loanNumber} &bull; Principal: {formatTZS(selectedLoan.principalAmount)}
                </p>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                ✕
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Due Date</th>
                    <th className="py-2.5 px-4 text-right">Principal</th>
                    <th className="py-2.5 px-4 text-right">Interest</th>
                    <th className="py-2.5 px-4 text-right">Total Installment</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {(selectedLoan.repayments || []).map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/75">
                      <td className="py-2.5 px-4">{s.installmentNumber}</td>
                      <td className="py-2.5 px-4 text-slate-800">
                        {new Date(s.dueDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-600">
                        {formatTZS(s.principalDue)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-600">
                        {formatTZS(s.interestDue)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-slate-900">
                        {formatTZS(s.totalDue)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusIndicator status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-medium"
              >
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10-Step Customer Loan Application Wizard Modal */}
      {showApplyWizard && (
        <LoanApplicationWizardModal
          products={products}
          onClose={() => setShowApplyWizard(false)}
          onSuccess={() => {
            fetchCustomerData();
          }}
        />
      )}

      {/* Customer Application Details & Status Tracker Modal */}
      {selectedApplication && (
        <ApplicationDetailsModal
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onRefresh={async () => {
            await fetchCustomerData();
            const updated = await api.applications.getById(selectedApplication.id);
            setSelectedApplication(updated);
          }}
        />
      )}

      {/* Loan Calculator & Simulator Modal */}
      {showCalculatorModal && (
        <LoanCalculatorWidget
          products={products}
          isModal={true}
          onClose={() => setShowCalculatorModal(false)}
          onApplyWithLoan={() => {
            setShowCalculatorModal(false);
            setShowApplyWizard(true);
          }}
        />
      )}
    </div>
  );
};
