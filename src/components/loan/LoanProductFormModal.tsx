import React, { useState } from 'react';
import { LoanProductDTO, RepaymentFrequency, InterestCalculationMethod } from '../../../shared/types/index.js';
import { CreateLoanProductInput } from '../../../shared/validators/product.js';
import { api } from '../../services/api.js';

interface LoanProductFormModalProps {
  product?: LoanProductDTO | null; // If provided, mode is EDIT; otherwise CREATE
  onClose: () => void;
  onSuccess: (savedProduct: LoanProductDTO) => void;
}

export const LoanProductFormModal: React.FC<LoanProductFormModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(product);

  const [formData, setFormData] = useState({
    code: product?.code || '',
    name: product?.name || '',
    description: product?.description || '',
    minAmount: product?.minAmount ?? 10000,
    maxAmount: product?.maxAmount ?? 500000,
    minTermMonths: product?.minTermMonths ?? 6,
    maxTermMonths: product?.maxTermMonths ?? 36,
    baseInterestRate: product?.baseInterestRate ?? 8.75,
    interestCalculationMethod: (product?.interestCalculationMethod as InterestCalculationMethod) || 'REDUCING_BALANCE_EQUAL_INSTALLMENTS',
    repaymentFrequency: (product?.repaymentFrequency as RepaymentFrequency) || 'MONTHLY',
    processingFeeType: (product?.processingFeeType as 'PERCENTAGE_OF_PRINCIPAL' | 'FIXED_AMOUNT') || 'PERCENTAGE_OF_PRINCIPAL',
    processingFeeValue: product?.processingFeeValue ?? 1.5,
    insuranceFeeType: (product?.insuranceFeeType as 'PERCENTAGE_OF_PRINCIPAL' | 'FIXED_AMOUNT') || 'PERCENTAGE_OF_PRINCIPAL',
    insuranceFeeValue: product?.insuranceFeeValue ?? 0.5,
    gracePeriodDays: product?.gracePeriodDays ?? 5,
    principalGracePeriodMonths: product?.principalGracePeriodMonths ?? 0,
    penaltyRate: product?.penaltyRate ?? 5.0,
    penaltyType: (product?.penaltyType as any) || 'LATE_PAYMENT',
    status: (product?.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') || 'ACTIVE',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.maxAmount < formData.minAmount) {
      setError('Maximum loan amount must be greater than or equal to minimum amount.');
      return;
    }
    if (formData.maxTermMonths < formData.minTermMonths) {
      setError('Maximum term months must be greater than or equal to minimum term.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateLoanProductInput = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        minAmount: Number(formData.minAmount),
        maxAmount: Number(formData.maxAmount),
        minTermMonths: Number(formData.minTermMonths),
        maxTermMonths: Number(formData.maxTermMonths),
        baseInterestRate: Number(formData.baseInterestRate),
        interestCalculationMethod: formData.interestCalculationMethod,
        repaymentFrequency: formData.repaymentFrequency,
        processingFeeType: formData.processingFeeType,
        processingFeeValue: Number(formData.processingFeeValue),
        insuranceFeeType: formData.insuranceFeeType,
        insuranceFeeValue: Number(formData.insuranceFeeValue),
        gracePeriodDays: Number(formData.gracePeriodDays),
        principalGracePeriodMonths: Number(formData.principalGracePeriodMonths),
        penaltyRate: Number(formData.penaltyRate),
        penaltyType: formData.penaltyType,
        status: formData.status,
      };

      let result: LoanProductDTO;
      if (isEdit && product) {
        result = await api.products.update(product.id, payload);
      } else {
        result = await api.products.create(payload);
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save loan product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEdit ? 'Edit Institutional Loan Product' : 'Create New Loan Product'}
            </h3>
            <p className="text-xs text-slate-500">
              Define credit facility parameters, interest calculation formulas, and risk boundaries
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* Section 1: Identification & Status */}
          <div className="space-y-3 p-3 bg-slate-50/80 border border-slate-200 rounded-lg">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Product Identification & Lifecycle Status
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Product Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  disabled={isEdit}
                  placeholder="e.g. PROD_REVOLVING_01"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none disabled:bg-slate-100"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Facility Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Small Business Commercial Working Capital"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Operational purpose, targeted borrower profile, and underwriting notes..."
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Lifecycle Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE (Authorized for new loan origination & disbursement)</option>
                <option value="INACTIVE">INACTIVE (Hidden from borrowers; existing loans remain serviced)</option>
                <option value="SUSPENDED">SUSPENDED (Temporarily paused under committee review)</option>
              </select>
            </div>
          </div>

          {/* Section 2: Financial Limits & Terms */}
          <div className="space-y-3 p-3 bg-slate-50/80 border border-slate-200 rounded-lg">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Principal & Tenor Bounds
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Minimum Loan Amount (TZS) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={100}
                  step={100}
                  value={formData.minAmount}
                  onChange={(e) => setFormData({ ...formData, minAmount: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Maximum Loan Amount (TZS) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={formData.minAmount}
                  step={500}
                  value={formData.maxAmount}
                  onChange={(e) => setFormData({ ...formData, maxAmount: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Minimum Term (Months) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={360}
                  value={formData.minTermMonths}
                  onChange={(e) => setFormData({ ...formData, minTermMonths: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Maximum Term (Months) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={formData.minTermMonths}
                  max={360}
                  value={formData.maxTermMonths}
                  onChange={(e) => setFormData({ ...formData, maxTermMonths: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Interest & Amortization Method */}
          <div className="space-y-3 p-3 bg-slate-50/80 border border-slate-200 rounded-lg">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Actuarial Interest Rate & Calculation Formula
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Base Interest Rate (% APR) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  step={0.01}
                  value={formData.baseInterestRate}
                  onChange={(e) => setFormData({ ...formData, baseInterestRate: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold text-emerald-800 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Interest Calculation Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.interestCalculationMethod}
                  onChange={(e) => setFormData({ ...formData, interestCalculationMethod: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="REDUCING_BALANCE_EQUAL_INSTALLMENTS">
                    Reducing Balance — Equal Installments (French Amortization)
                  </option>
                  <option value="REDUCING_BALANCE_EQUAL_PRINCIPAL">
                    Reducing Balance — Equal Principal (Declining Total Payments)
                  </option>
                  <option value="FLAT_RATE">Flat Rate (Constant Interest On Initial Principal)</option>
                  <option value="SIMPLE_INTEREST">Simple Interest (Linear Accrual)</option>
                  <option value="COMPOUND_INTEREST">Compound Periodic Interest</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Repayment Frequency <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.repaymentFrequency}
                onChange={(e) => setFormData({ ...formData, repaymentFrequency: e.target.value as any })}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              >
                <option value="DAILY">Daily (365 periods/year)</option>
                <option value="WEEKLY">Weekly (52 periods/year)</option>
                <option value="BI_WEEKLY">Bi-Weekly (26 periods/year)</option>
                <option value="MONTHLY">Monthly (12 periods/year — Standard)</option>
                <option value="QUARTERLY">Quarterly (4 periods/year)</option>
                <option value="SEMI_ANNUALLY">Semi-Annually (2 periods/year)</option>
                <option value="ANNUALLY">Annually (1 period/year)</option>
                <option value="BULLET_AT_MATURITY">Bullet Repayment at Maturity</option>
              </select>
            </div>
          </div>

          {/* Section 4: Fees, Grace Period & Penalty Rules */}
          <div className="space-y-3 p-3 bg-slate-50/80 border border-slate-200 rounded-lg">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Institutional Fees, Grace Periods & Penalties
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Processing Fee Structure</label>
                <div className="flex gap-2">
                  <select
                    value={formData.processingFeeType}
                    onChange={(e) => setFormData({ ...formData, processingFeeType: e.target.value as any })}
                    className="w-3/5 px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="PERCENTAGE_OF_PRINCIPAL">% of Principal</option>
                    <option value="FIXED_AMOUNT">Fixed (TZS)</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.processingFeeValue}
                    onChange={(e) => setFormData({ ...formData, processingFeeValue: Number(e.target.value) })}
                    className="w-2/5 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Credit Insurance Fee Structure</label>
                <div className="flex gap-2">
                  <select
                    value={formData.insuranceFeeType}
                    onChange={(e) => setFormData({ ...formData, insuranceFeeType: e.target.value as any })}
                    className="w-3/5 px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  >
                    <option value="PERCENTAGE_OF_PRINCIPAL">% of Principal</option>
                    <option value="FIXED_AMOUNT">Fixed (TZS)</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={formData.insuranceFeeValue}
                    onChange={(e) => setFormData({ ...formData, insuranceFeeValue: Number(e.target.value) })}
                    className="w-2/5 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Grace Period (Days)</label>
                <input
                  type="number"
                  min={0}
                  max={90}
                  value={formData.gracePeriodDays}
                  onChange={(e) => setFormData({ ...formData, gracePeriodDays: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Late Penalty Rate (% / mo)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  step={0.25}
                  value={formData.penaltyRate}
                  onChange={(e) => setFormData({ ...formData, penaltyRate: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-medium text-rose-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Penalty Enforcement Trigger</label>
                <select
                  value={formData.penaltyType}
                  onChange={(e) => setFormData({ ...formData, penaltyType: e.target.value as any })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="LATE_PAYMENT">Late Installment</option>
                  <option value="DEFAULT">Facility Default</option>
                  <option value="DISHONOURED_PAYMENT">Bounced Cheque / ACH</option>
                  <option value="COVENANT_BREACH">Covenant Breach</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isSubmitting
                ? isEdit
                  ? 'Saving Changes...'
                  : 'Creating Product...'
                : isEdit
                ? 'Save Product Parameters'
                : 'Publish Loan Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
