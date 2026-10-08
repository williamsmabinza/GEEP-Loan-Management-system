import React, { useState, useEffect } from 'react';
import {
  LoanProductDTO,
  LoanCalculationResultDTO,
  InterestCalculationMethod,
  RepaymentFrequency,
} from '../../../shared/types/index.js';
import { api } from '../../services/api.js';
import { formatTZS } from '../../utils/currency.js';

interface LoanCalculatorWidgetProps {
  products?: LoanProductDTO[];
  initialProductId?: string;
  onApplyWithLoan?: (details: {
    productId: string;
    principal: number;
    termMonths: number;
  }) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const LoanCalculatorWidget: React.FC<LoanCalculatorWidgetProps> = ({
  products = [],
  initialProductId,
  onApplyWithLoan,
  isModal = false,
  onClose,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || (products.length > 0 ? products[0].id : '')
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Calculator Inputs
  const [principal, setPrincipal] = useState<number>(
    selectedProduct ? Math.round((selectedProduct.minAmount + selectedProduct.maxAmount) / 2) : 25000
  );
  const [termMonths, setTermMonths] = useState<number>(
    selectedProduct ? selectedProduct.minTermMonths + 6 : 12
  );
  const [annualRate, setAnnualRate] = useState<number>(
    selectedProduct ? selectedProduct.baseInterestRate : 8.75
  );
  const [method, setMethod] = useState<InterestCalculationMethod>(
    (selectedProduct?.interestCalculationMethod as InterestCalculationMethod) ||
      'REDUCING_BALANCE_EQUAL_INSTALLMENTS'
  );
  const [frequency, setFrequency] = useState<RepaymentFrequency>(
    (selectedProduct?.repaymentFrequency as RepaymentFrequency) || 'MONTHLY'
  );
  const [includeFees, setIncludeFees] = useState(true);
  const [showScheduleTable, setShowScheduleTable] = useState(false);

  // Calculation Results
  const [calcResult, setCalcResult] = useState<LoanCalculationResultDTO | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize when product selection changes
  useEffect(() => {
    if (selectedProduct) {
      setPrincipal((prev) => {
        if (prev < selectedProduct.minAmount) return selectedProduct.minAmount;
        if (prev > selectedProduct.maxAmount) return selectedProduct.maxAmount;
        return prev;
      });
      setTermMonths((prev) => {
        if (prev < selectedProduct.minTermMonths) return selectedProduct.minTermMonths;
        if (prev > selectedProduct.maxTermMonths) return selectedProduct.maxTermMonths;
        return prev;
      });
      setAnnualRate(selectedProduct.baseInterestRate);
      setMethod(
        (selectedProduct.interestCalculationMethod as InterestCalculationMethod) ||
          'REDUCING_BALANCE_EQUAL_INSTALLMENTS'
      );
      setFrequency((selectedProduct.repaymentFrequency as RepaymentFrequency) || 'MONTHLY');
    }
  }, [selectedProductId]);

  const runCalculation = async () => {
    setIsCalculating(true);
    setError(null);
    try {
      const payload = {
        principal: Number(principal),
        annualRate: Number(annualRate),
        termMonths: Number(termMonths),
        interestCalculationMethod: method,
        repaymentFrequency: frequency,
        processingFeeType: includeFees && selectedProduct ? selectedProduct.processingFeeType : undefined,
        processingFeeValue: includeFees && selectedProduct ? selectedProduct.processingFeeValue : 0,
        insuranceFeeType: includeFees && selectedProduct ? selectedProduct.insuranceFeeType : undefined,
        insuranceFeeValue: includeFees && selectedProduct ? selectedProduct.insuranceFeeValue : 0,
        startDate: new Date().toISOString().split('T')[0],
      };

      const result = await api.products.calculate(payload);
      setCalcResult(result);
    } catch (err) {
      setError((err as Error).message || 'Calculation failed');
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runCalculation();
    }, 200);
    return () => clearTimeout(timer);
  }, [principal, termMonths, annualRate, method, frequency, includeFees, selectedProductId]);

  const minAmt = selectedProduct ? selectedProduct.minAmount : 1000;
  const maxAmt = selectedProduct ? selectedProduct.maxAmount : 1000000;
  const minTerm = selectedProduct ? selectedProduct.minTermMonths : 1;
  const maxTerm = selectedProduct ? selectedProduct.maxTermMonths : 120;

  const content = (
    <div className="space-y-6 text-xs">
      {/* Top Header if in Modal */}
      {isModal && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Institutional Credit Amortization Calculator
            </h3>
            <p className="text-slate-500 text-[11px] mt-0.5">
              High-precision decimal-safe financial calculation engine with custom interest methods
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            >
              &times;
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configurator Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Facility Product Picker */}
          {products.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
              <label className="block font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                Institutional Loan Product Benchmark
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) &bull; {p.baseInterestRate}% APR
                  </option>
                ))}
              </select>
              {selectedProduct?.description && (
                <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5">
                  {selectedProduct.description}
                </p>
              )}
            </div>
          )}

          {/* Principal Slider & Input */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                Principal Borrowing Capital (TZS)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={minAmt}
                  max={maxAmt}
                  step={500}
                  value={principal}
                  onChange={(e) => setPrincipal(Number(e.target.value))}
                  className="w-44 px-2.5 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none text-right"
                />
              </div>
            </div>
            <input
              type="range"
              min={minAmt}
              max={maxAmt}
              step={500}
              value={principal}
              onChange={(e) => setPrincipal(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Min: {formatTZS(minAmt)}</span>
              <span>Max: {formatTZS(maxAmt)}</span>
            </div>
          </div>

          {/* Tenor Slider & Input */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                Tenor / Duration (Months)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={minTerm}
                  max={maxTerm}
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none text-right"
                />
                <span className="text-slate-500 font-medium">Months</span>
              </div>
            </div>
            <input
              type="range"
              min={minTerm}
              max={maxTerm}
              step={1}
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>{minTerm} Months</span>
              <span>{(termMonths / 12).toFixed(1)} Years</span>
              <span>{maxTerm} Months</span>
            </div>
          </div>

          {/* Interest Rate & Methods Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-white border border-slate-200 rounded-lg">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Interest Rate (% APR)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.05}
                  value={annualRate}
                  onChange={(e) => setAnnualRate(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none"
                />
                <span className="absolute right-3 top-1.5 text-slate-400 font-mono">%</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Repayment Frequency
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RepaymentFrequency)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white focus:outline-none"
              >
                <option value="DAILY">Daily (365 / yr)</option>
                <option value="WEEKLY">Weekly (52 / yr)</option>
                <option value="BI_WEEKLY">Bi-Weekly (26 / yr)</option>
                <option value="MONTHLY">Monthly (12 / yr)</option>
                <option value="QUARTERLY">Quarterly (4 / yr)</option>
                <option value="ANNUALLY">Annually (1 / yr)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Interest Calculation Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as InterestCalculationMethod)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-semibold bg-white focus:outline-none"
              >
                <option value="REDUCING_BALANCE_EQUAL_INSTALLMENTS">
                  Reducing Balance — Equal Installments (French Amortization)
                </option>
                <option value="REDUCING_BALANCE_EQUAL_PRINCIPAL">
                  Reducing Balance — Equal Principal (Declining Installments)
                </option>
                <option value="FLAT_RATE">Flat Rate (Constant Total Interest)</option>
                <option value="SIMPLE_INTEREST">Simple Interest (Linear Accrual)</option>
                <option value="COMPOUND_INTEREST">Compound Periodic Interest</option>
              </select>
            </div>

            {selectedProduct && (
              <div className="col-span-2 flex items-center justify-between pt-1 text-[11px] text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFees}
                    onChange={(e) => setIncludeFees(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Include Facility Fees (Processing & Credit Insurance)</span>
                </label>
                {includeFees && (
                  <span className="font-mono text-slate-500">
                    Proc: {selectedProduct.processingFeeValue}% &bull; Ins: {selectedProduct.insuranceFeeValue}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Calculated Quotation Results (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="p-5 bg-slate-900 text-white rounded-xl shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Estimated Periodic Payment
              </span>
              <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-[10px] text-emerald-400 font-semibold">
                {frequency}
              </span>
            </div>

            <div>
              <div className="text-3xl font-extrabold font-mono text-emerald-400 tracking-tight">
                {formatTZS(calcResult?.installmentAmount || 0)}
              </div>
              <span className="text-slate-400 text-[11px] mt-1 block">
                Per {frequency.toLowerCase()} installment for {calcResult?.numberOfInstallments || 0} installments
              </span>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Principal Capital</span>
                <span className="font-mono font-medium text-white">{formatTZS(principal)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Total Expected Interest</span>
                <span className="font-mono font-medium text-white">
                  {formatTZS(calcResult?.totalInterest || 0)}
                </span>
              </div>
              {includeFees && (
                <div className="flex justify-between text-slate-300">
                  <span>Origination & Insurance Fees</span>
                  <span className="font-mono font-medium text-white">
                    {formatTZS(calcResult?.totalFees || 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-800 text-sm font-bold text-white">
                <span>Total Amount Payable</span>
                <span className="font-mono text-emerald-400">
                  {formatTZS(calcResult?.totalPayable || 0)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                <span>Effective APR (All-in)</span>
                <span className="font-mono">{calcResult?.apr || annualRate}%</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowScheduleTable(!showScheduleTable)}
              className="w-full py-2 px-3 border border-slate-300 text-slate-700 bg-white rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>{showScheduleTable ? 'Hide' : 'Inspect'} Full Amortization Schedule</span>
              <span>({calcResult?.schedule.length || 0} periods)</span>
            </button>

            {onApplyWithLoan && selectedProduct && (
              <button
                type="button"
                onClick={() =>
                  onApplyWithLoan({
                    productId: selectedProduct.id,
                    principal,
                    termMonths,
                  })
                }
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors shadow-sm"
              >
                Apply for this Credit Facility &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Amortization Schedule Drawer / Table */}
      {showScheduleTable && calcResult && (
        <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Complete Repayment Amortization Schedule
              </h4>
              <p className="text-[10px] text-slate-500">
                Exact decimal-safe breakdown of principal amortization, periodic interest, and remaining debt balance
              </p>
            </div>
            <button
              onClick={() => setShowScheduleTable(false)}
              className="text-slate-400 hover:text-slate-600 text-sm font-medium"
            >
              &times; Close Table
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Due Date</th>
                  <th className="py-2 px-3 text-right">Principal Due</th>
                  <th className="py-2 px-3 text-right">Interest Due</th>
                  <th className="py-2 px-3 text-right">Total Installment</th>
                  <th className="py-2 px-3 text-right">Remaining Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {calcResult.schedule.map((item) => (
                  <tr key={item.installmentNumber} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-sans text-slate-500">{item.installmentNumber}</td>
                    <td className="py-2 px-3 text-slate-700">
                      {new Date(item.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-800">
                      {formatTZS(item.principalDue)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {formatTZS(item.interestDue)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {formatTZS(item.totalDue)}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">
                      {formatTZS(item.remainingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full p-6 shadow-2xl max-h-[94vh] overflow-y-auto animate-in fade-in zoom-in duration-150">
          {content}
        </div>
      </div>
    );
  }

  return <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">{content}</div>;
};
