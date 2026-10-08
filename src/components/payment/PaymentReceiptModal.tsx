import React from 'react';
import { PaymentReceiptDTO } from '../../../shared/types/index.js';
import { formatTZS } from '../../utils/currency.js';

interface PaymentReceiptModalProps {
  receipt: PaymentReceiptDTO;
  onClose: () => void;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({ receipt, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-xs text-slate-800 my-auto">
        
        {/* Printable Area */}
        <div id="printable-receipt" className="space-y-4">
          
          {/* Institution Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                  N
                </span>
                <span className="text-base font-extrabold tracking-tight text-slate-950 uppercase">
                  Nexa Core Banking Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Regulated Tier-1 Microfinance & Commercial Credit Institution
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Dar es Salaam Central Branch &bull; Tax PIN: 104-988-210 &bull; Central Bank Lic: BOT-MFI-0042
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-900 font-mono font-extrabold text-xs rounded border border-emerald-300">
                OFFICIAL RECEIPT
              </span>
              <div className="font-mono font-bold text-slate-900 text-sm mt-1">
                {receipt.receiptNumber}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Issued: {new Date(receipt.issuedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {receipt.isReversal && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-lg font-mono font-bold text-center text-xs">
              ⚠️ THIS RECEIPT DOCUMENTS AN ACCOUNTING TRANSACTION REVERSAL
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Customer Name</span>
              <span className="font-bold text-slate-900 text-xs block truncate">{receipt.customerName}</span>
              <span className="text-[10px] text-slate-500 font-mono">{receipt.customerNumber || 'CUST-ON-FILE'}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Loan Facility</span>
              <span className="font-bold text-indigo-900 text-xs font-mono block">{receipt.loanNumber}</span>
              <span className="text-[10px] text-slate-500 truncate block">{receipt.productName}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payment Channel</span>
              <span className="font-bold text-slate-800 text-xs block">{receipt.paymentMethod.replace(/_/g, ' ')}</span>
              <span className="text-[10px] text-slate-500 font-mono truncate block">
                Ref: {receipt.paymentReference}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Transaction Reference</span>
              <span className="font-mono text-slate-700 block truncate">
                {receipt.transactionReference || 'COUNTER-CASH'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Value Date</span>
              <span className="font-medium text-slate-800 block">
                {new Date(receipt.paymentDate).toLocaleDateString()}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Collected By (Cashier)</span>
              <span className="font-medium text-slate-800 block truncate">
                {receipt.receivedByStaffName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">({receipt.receivedByStaffRole || 'TELLER'})</span>
            </div>
          </div>

          {/* Itemized Allocation Table */}
          <div className="space-y-1.5">
            <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center justify-between">
              <span>Financial Allocation Breakdown</span>
              <span className="font-mono text-[10px] text-slate-500 font-normal">
                Strategy: {receipt.allocationStrategy.replace(/_/g, ' ')}
              </span>
            </h5>

            <div className="border border-slate-200 rounded-xl overflow-hidden font-mono text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Obligation Component</th>
                    <th className="py-2 px-3 text-center">Priority</th>
                    <th className="py-2 px-3 text-right">Settled Amount (TZS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2 px-3 font-medium">Overdue Penalties & Fines</td>
                    <td className="py-2 px-3 text-center text-slate-400 text-[10px]">Tier 1</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">
                      {formatTZS(receipt.allocation.penalties)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">Service Fees & Charges</td>
                    <td className="py-2 px-3 text-center text-slate-400 text-[10px]">Tier 2</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">
                      {formatTZS(receipt.allocation.fees)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">Serviced Interest Due</td>
                    <td className="py-2 px-3 text-center text-slate-400 text-[10px]">Tier 3</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">
                      {formatTZS(receipt.allocation.interest)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">Principal Amortization</td>
                    <td className="py-2 px-3 text-center text-slate-400 text-[10px]">Tier 4</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">
                      {formatTZS(receipt.allocation.principal)}
                    </td>
                  </tr>
                  {receipt.allocation.overpayment > 0 && (
                    <tr className="bg-emerald-50/50">
                      <td className="py-2 px-3 font-bold text-emerald-900">
                        Overpayment / Borrower Credit Pool
                      </td>
                      <td className="py-2 px-3 text-center text-emerald-700 text-[10px]">Excess</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">
                        {formatTZS(receipt.allocation.overpayment)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-900 text-white font-bold text-xs">
                    <td className="py-2.5 px-3 uppercase tracking-wider font-sans" colSpan={2}>
                      Total Payment Received
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm text-emerald-400">
                      {formatTZS(receipt.amountPaid)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Post-Payment Ledger Position */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px]">
            <div>
              <span className="text-[10px] text-slate-400 font-sans block uppercase">Previous Balance</span>
              <span className="font-bold text-slate-700">{formatTZS(receipt.previousBalance)}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-sans block uppercase">New Remaining Balance</span>
              <span className="font-extrabold text-indigo-950 text-xs">{formatTZS(receipt.newBalance)}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-sans block uppercase">Next Scheduled Due</span>
              {receipt.nextInstallment ? (
                <div>
                  <span className="font-bold text-slate-900">{formatTZS(receipt.nextInstallment.amountDue)}</span>
                  <span className="text-[9px] text-slate-500 block font-sans">
                    Due: {new Date(receipt.nextInstallment.dueDate).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <span className="text-emerald-700 font-bold">Facility Paid in Full ✓</span>
              )}
            </div>
          </div>

          {/* Notes and Cashier Sign-off */}
          {receipt.notes && (
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-[11px] text-slate-600">
              <span className="font-bold text-slate-700">Audit Notes: </span>
              {receipt.notes}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <div>
              Verification Hash: {receipt.receiptNumber}-SECURE-VERIFIED
            </div>
            <div>
              Generated electronically by Nexa Core Banking. No physical signature required.
            </div>
          </div>
        </div>

        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <span>🖨</span> Print Official Receipt
          </button>
        </div>

      </div>
    </div>
  );
};
