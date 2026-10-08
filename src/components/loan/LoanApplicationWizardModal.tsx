import React, { useState, useEffect } from 'react';
import {
  LoanProductDTO,
  LoanApplicationDTO,
  ApplicationDocumentDTO,
  RepaymentFrequency,
} from '../../../shared/types/index.js';
import { api } from '../../services/api.js';
import { formatTZS } from '../../utils/currency.js';
import { ApplicationTimelineTracker } from './ApplicationTimelineTracker.js';

interface LoanApplicationWizardModalProps {
  products: LoanProductDTO[];
  initialProductId?: string;
  onClose: () => void;
  onSuccess: (application: LoanApplicationDTO) => void;
}

export const LoanApplicationWizardModal: React.FC<LoanApplicationWizardModalProps> = ({
  products,
  initialProductId,
  onClose,
  onSuccess,
}) => {
  // Wizard Steps: 1: Product Selection, 2: Amount & Term, 3: Borrower Information, 4: Supporting Documents, 5: Review & Submit, 6: Submitted/Tracker
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Selected Product
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || (products.length > 0 ? products[0].id : '')
  );
  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  // Step 2: Amount & Term
  const [principalAmount, setPrincipalAmount] = useState<number>(
    selectedProduct ? Math.round((selectedProduct.minAmount + selectedProduct.maxAmount) / 2) : 10000000
  );
  const [termMonths, setTermMonths] = useState<number>(
    selectedProduct ? selectedProduct.minTermMonths + 6 : 12
  );
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>(
    (selectedProduct?.repaymentFrequency as RepaymentFrequency) || 'MONTHLY'
  );
  const [purpose, setPurpose] = useState<string>('Operating capital and commercial business expansion');

  // Step 3: Required Borrower Information
  const [employerName, setEmployerName] = useState<string>('Tanzania Commercial Enterprises Ltd');
  const [jobTitle, setJobTitle] = useState<string>('Operations Director');
  const [employmentType, setEmploymentType] = useState<string>('FULL_TIME_SALARIED');
  const [monthlyIncome, setMonthlyIncome] = useState<number>(6500000); // 6.5M TZS

  const [bankName, setBankName] = useState<string>('CRDB Bank Plc');
  const [accountNumber, setAccountNumber] = useState<string>('0150293847100');
  const [accountName, setAccountName] = useState<string>('Alexander Hayes');

  const [guarantorName, setGuarantorName] = useState<string>('Robert Vance Sterling');
  const [guarantorPhone, setGuarantorPhone] = useState<string>('+255 754 112 233');
  const [guarantorRelationship, setGuarantorRelationship] = useState<string>('Business Partner');
  const [guarantorAmount, setGuarantorAmount] = useState<number>(10000000);

  const [collateralType, setCollateralType] = useState<string>('Commercial Real Estate');
  const [collateralValue, setCollateralValue] = useState<number>(75000000);
  const [collateralDesc, setCollateralDesc] = useState<string>('Warehouse plot No. 44B, Kurasini Industrial Area, Dar es Salaam');

  // Step 4: Supporting Documents
  const [documents, setDocuments] = useState<Array<{ documentType: string; documentName: string; fileSize: string; fileUrl: string }>>([
    {
      documentType: 'National ID / NIDA Card',
      documentName: 'NIDA_Identification_Card.pdf',
      fileSize: '1.2 MB',
      fileUrl: '/uploads/nida_card.pdf',
    },
    {
      documentType: 'Proof of Income / 3 Months Payslip',
      documentName: 'Official_Payslips_Last3Months.pdf',
      fileSize: '2.4 MB',
      fileUrl: '/uploads/payslips.pdf',
    },
  ]);

  const [newDocType, setNewDocType] = useState<string>('Bank Statement (6 Months)');
  const [newDocName, setNewDocName] = useState<string>('');

  // Step 5: Calculation Preview (Decimal-Safe from Backend)
  const [calcPreview, setCalcPreview] = useState<{
    installmentAmount: number;
    totalInterest: number;
    totalFees: number;
    totalPayable: number;
  }>({ installmentAmount: 0, totalInterest: 0, totalFees: 0, totalPayable: 0 });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedApplication, setSubmittedApplication] = useState<LoanApplicationDTO | null>(null);

  // Sync bounds when product changes
  useEffect(() => {
    if (selectedProduct) {
      if (principalAmount < selectedProduct.minAmount) {
        setPrincipalAmount(selectedProduct.minAmount);
      } else if (principalAmount > selectedProduct.maxAmount) {
        setPrincipalAmount(selectedProduct.maxAmount);
      }

      if (termMonths < selectedProduct.minTermMonths) {
        setTermMonths(selectedProduct.minTermMonths);
      } else if (termMonths > selectedProduct.maxTermMonths) {
        setTermMonths(selectedProduct.maxTermMonths);
      }

      setRepaymentFrequency((selectedProduct.repaymentFrequency as RepaymentFrequency) || 'MONTHLY');
    }
  }, [selectedProductId]);

  // Recalculate decimal-safe loan terms
  useEffect(() => {
    if (!selectedProduct || !principalAmount || !termMonths) return;
    let cancelled = false;

    const runCalc = async () => {
      try {
        const result = await api.products.calculate({
          principal: principalAmount,
          annualRate: selectedProduct.baseInterestRate,
          termMonths,
          interestCalculationMethod: selectedProduct.interestCalculationMethod as any,
          repaymentFrequency,
          processingFeeType: selectedProduct.processingFeeType,
          processingFeeValue: selectedProduct.processingFeeValue,
          insuranceFeeType: selectedProduct.insuranceFeeType,
          insuranceFeeValue: selectedProduct.insuranceFeeValue,
        });

        if (!cancelled) {
          setCalcPreview({
            installmentAmount: result.installmentAmount,
            totalInterest: result.totalInterest,
            totalFees: result.totalFees,
            totalPayable: result.totalPayable,
          });
        }
      } catch {
        // Fallback
      }
    };

    const timer = setTimeout(runCalc, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [principalAmount, termMonths, repaymentFrequency, selectedProduct]);

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    setDocuments((prev) => [
      ...prev,
      {
        documentType: newDocType,
        documentName: newDocName.trim().endsWith('.pdf') ? newDocName.trim() : `${newDocName.trim()}.pdf`,
        fileSize: '1.8 MB',
        fileUrl: `/uploads/${Date.now()}_doc.pdf`,
      },
    ]);
    setNewDocName('');
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (isDraft = false) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        productId: selectedProduct.id,
        principalAmount: Number(principalAmount),
        termMonths: Number(termMonths),
        repaymentFrequency,
        purpose: purpose.trim(),
        status: (isDraft ? 'DRAFT' : 'SUBMITTED') as 'DRAFT' | 'SUBMITTED',
        employmentInfo: {
          employerName,
          jobTitle,
          monthlyIncome: Number(monthlyIncome),
          employmentType,
        },
        bankDetails: {
          bankName,
          accountNumber,
          accountName,
        },
        guarantorInfo: {
          name: guarantorName,
          phone: guarantorPhone,
          relationship: guarantorRelationship,
          guaranteedAmount: Number(guarantorAmount),
        },
        collateralInfo: {
          type: collateralType,
          estimatedValue: Number(collateralValue),
          description: collateralDesc,
        },
        documents: documents.map((d) => ({
          documentType: d.documentType,
          documentName: d.documentName,
          fileSize: d.fileSize,
          fileUrl: d.fileUrl,
        })),
      };

      const result = await api.applications.create(payload);
      setSubmittedApplication(result);
      setCurrentStep(6);
      onSuccess(result);
    } catch (err) {
      setError((err as Error).message || 'Failed to submit loan application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[94vh] flex flex-col animate-in fade-in zoom-in duration-150">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">
                Institutional Loan Origination Application
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              All financial values, limits, and obligations denominated in Tanzanian Shillings (TZS)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Step Indicator Header */}
        {currentStep < 6 && (
          <div className="flex items-center justify-between px-2 text-xs">
            {[
              { num: 1, title: '1. Select Product' },
              { num: 2, title: '2. Amount & Tenor' },
              { num: 3, title: '3. Borrower Info' },
              { num: 4, title: '4. Supporting Docs' },
              { num: 5, title: '5. Review & Submit' },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-1.5 font-medium ${
                  currentStep === s.num
                    ? 'text-indigo-900 font-bold'
                    : currentStep > s.num
                    ? 'text-emerald-700'
                    : 'text-slate-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                    currentStep === s.num
                      ? 'bg-indigo-900 text-white'
                      : currentStep > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {currentStep > s.num ? '✓' : s.num}
                </span>
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-700 font-bold ml-2">
              &times;
            </button>
          </div>
        )}

        {/* Scrollable Step Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* STEP 1: Select Loan Product */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Step 1: Choose Credit Facility Product</h4>
                  <p className="text-slate-500 text-[11px]">Select from active institutional lending facilities below</p>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">{products.length} products available</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => {
                  const isSelected = p.id === selectedProductId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                        isSelected
                          ? 'border-indigo-900 bg-indigo-50/40 ring-2 ring-indigo-900/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {p.code}
                        </span>
                        <span className="font-mono font-bold text-emerald-700 text-xs">
                          {p.baseInterestRate}% APR
                        </span>
                      </div>

                      <div>
                        <h5 className="font-bold text-slate-900 text-sm">{p.name}</h5>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {p.description || 'Institutional credit facility with flexible amortization.'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-sans">Borrowing Bounds</span>
                          <span className="text-slate-800 font-semibold">
                            {formatTZS(p.minAmount, { compact: true })} – {formatTZS(p.maxAmount, { compact: true })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-sans">Tenor Limits</span>
                          <span className="text-slate-800 font-semibold">
                            {p.minTermMonths} – {p.maxTermMonths} Mo
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Enter Requested Amount, Term, Purpose */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Step 2: Borrowing Capital & Tenor Parameters</h4>
                <p className="text-slate-500 text-[11px]">
                  Selected Facility: <span className="font-bold text-slate-800">{selectedProduct.name}</span> ({selectedProduct.code})
                </p>
              </div>

              {/* Principal Amount Input */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                    Requested Principal Capital ({selectedProduct.code})
                  </label>
                  <div className="flex items-center gap-1 font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1">
                    <span className="text-slate-400 text-xs">TZS</span>
                    <input
                      type="number"
                      min={selectedProduct.minAmount}
                      max={selectedProduct.maxAmount}
                      step={500000}
                      value={principalAmount}
                      onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                      className="w-40 text-right font-mono text-sm font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={selectedProduct.minAmount}
                  max={selectedProduct.maxAmount}
                  step={500000}
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer"
                />

                <div className="flex justify-between font-mono text-[10px] text-slate-500">
                  <span>Min: {formatTZS(selectedProduct.minAmount)}</span>
                  <span className="font-bold text-slate-800">{formatTZS(principalAmount)}</span>
                  <span>Max: {formatTZS(selectedProduct.maxAmount)}</span>
                </div>
              </div>

              {/* Term & Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                      Loan Tenor (Months)
                    </label>
                    <span className="font-mono font-bold text-slate-900">{termMonths} Months</span>
                  </div>

                  <input
                    type="range"
                    min={selectedProduct.minTermMonths}
                    max={selectedProduct.maxTermMonths}
                    step={1}
                    value={termMonths}
                    onChange={(e) => setTermMonths(Number(e.target.value))}
                    className="w-full accent-slate-900 cursor-pointer"
                  />

                  <div className="flex justify-between font-mono text-[10px] text-slate-500">
                    <span>{selectedProduct.minTermMonths} Mo</span>
                    <span>{(termMonths / 12).toFixed(1)} Years</span>
                    <span>{selectedProduct.maxTermMonths} Mo</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                    Repayment Frequency
                  </label>
                  <select
                    value={repaymentFrequency}
                    onChange={(e) => setRepaymentFrequency(e.target.value as RepaymentFrequency)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:outline-none"
                  >
                    <option value="MONTHLY">Monthly (12 periods/year)</option>
                    <option value="QUARTERLY">Quarterly (4 periods/year)</option>
                    <option value="BI_WEEKLY">Bi-Weekly (26 periods/year)</option>
                    <option value="WEEKLY">Weekly (52 periods/year)</option>
                    <option value="DAILY">Daily (365 periods/year)</option>
                  </select>
                  <span className="text-[10px] text-slate-400 block">
                    Benchmark Rate: {selectedProduct.baseInterestRate}% APR
                  </span>
                </div>
              </div>

              {/* Loan Purpose */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  Articulated Commercial Purpose <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Detail liquidity requirement, commercial project scope, and anticipated cash flow returns..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              {/* Decimal-Safe Repayment Calculation Badge */}
              <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Actuarial Amortization Estimate (Decimal-Safe)
                  </span>
                  <span className="font-mono text-[10px] text-emerald-400 font-bold">{repaymentFrequency}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono pt-1">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Installment Due</span>
                    <span className="text-sm font-extrabold text-emerald-400">
                      {formatTZS(calcPreview.installmentAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Expected Interest</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {formatTZS(calcPreview.totalInterest)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Origination Fees</span>
                    <span className="text-xs font-semibold text-slate-200">
                      {formatTZS(calcPreview.totalFees)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Total Obligation</span>
                    <span className="text-xs font-bold text-white">
                      {formatTZS(calcPreview.totalPayable)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Provide Required Information */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Step 3: Provide Required Financial Information</h4>
                <p className="text-slate-500 text-[11px]">Enter employment, banking, guarantor, and collateral underwriting data</p>
              </div>

              {/* Employment & Income */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  1. Employment & Operating Income Profile
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Employer / Registered Business Name</label>
                    <input
                      type="text"
                      value={employerName}
                      onChange={(e) => setEmployerName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Position / Job Title</label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Employment / Operation Type</label>
                    <select
                      value={employmentType}
                      onChange={(e) => setEmploymentType(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="FULL_TIME_SALARIED">Full-time Salaried Professional</option>
                      <option value="BUSINESS_OWNER">Registered Business Owner / Director</option>
                      <option value="SELF_EMPLOYED">Self-Employed Merchant</option>
                      <option value="CONTRACTOR">Corporate Contractor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Verified Monthly Net Income (TZS)</label>
                    <input
                      type="number"
                      step={100000}
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Settlement Bank Details */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  2. Settlement Bank Account Details
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Commercial Bank</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Account Name</label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Guarantor & Collateral */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    3. Guarantor Information
                  </h5>
                  <div>
                    <label className="block text-slate-600 mb-1">Guarantor Full Name</label>
                    <input
                      type="text"
                      value={guarantorName}
                      onChange={(e) => setGuarantorName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Phone & Relationship</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={guarantorPhone}
                        onChange={(e) => setGuarantorPhone(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white"
                      />
                      <input
                        type="text"
                        value={guarantorRelationship}
                        onChange={(e) => setGuarantorRelationship(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Guaranteed Amount (TZS)</label>
                    <input
                      type="number"
                      step={500000}
                      value={guarantorAmount}
                      onChange={(e) => setGuarantorAmount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    4. Pledged Collateral Security
                  </h5>
                  <div>
                    <label className="block text-slate-600 mb-1">Collateral Asset Category</label>
                    <input
                      type="text"
                      value={collateralType}
                      onChange={(e) => setCollateralType(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Estimated Valuation (TZS)</label>
                    <input
                      type="number"
                      step={1000000}
                      value={collateralValue}
                      onChange={(e) => setCollateralValue(Number(e.target.value))}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Description / Location</label>
                    <input
                      type="text"
                      value={collateralDesc}
                      onChange={(e) => setCollateralDesc(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Upload Supporting Documents */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Step 4: Upload Supporting Documents</h4>
                <p className="text-slate-500 text-[11px]">
                  Attach compliance verifications, income records, and title deeds to expedite loan officer underwriting
                </p>
              </div>

              {/* Document List */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Document Type</th>
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3 text-right">Size</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {documents.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-800">{d.documentType}</td>
                        <td className="py-2 px-3 text-slate-700">{d.documentName}</td>
                        <td className="py-2 px-3 text-right text-slate-400">{d.fileSize}</td>
                        <td className="py-2 px-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(idx)}
                            className="text-rose-600 hover:text-rose-800 font-semibold text-[11px]"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add New Document Form */}
              <form onSubmit={handleAddDocument} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  + Attach New Verification Document
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">Document Category</label>
                    <select
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="National ID / NIDA Card">National ID / NIDA Card</option>
                      <option value="Proof of Income / 3 Months Payslip">Proof of Income / Payslip</option>
                      <option value="Bank Statement (6 Months)">Bank Statement (6 Months)</option>
                      <option value="Business Registration / BRELA Certificate">BRELA Business Registration</option>
                      <option value="Collateral Title Deed / Asset Registration">Collateral Title Deed</option>
                      <option value="Tax Clearance Certificate / TRA TIN">TRA Tax Clearance</option>
                      <option value="Guarantor Identification Form">Guarantor Identification Form</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">File Name / Label</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CRDB_Bank_Statement_6Mo.pdf"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium text-xs shadow-2xs"
                    >
                      Attach Document
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Step 5: Review Application Dossier & Submit</h4>
                <p className="text-slate-500 text-[11px]">
                  Confirm all facility terms, borrower information, and compliance attachments before final submission
                </p>
              </div>

              {/* Review Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <span className="font-mono text-[10px] uppercase font-bold text-slate-500">{selectedProduct.code}</span>
                    <h5 className="font-bold text-slate-900 text-base">{selectedProduct.name}</h5>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-400 block uppercase font-sans">Principal Amount</span>
                    <span className="text-base font-extrabold text-indigo-900">{formatTZS(principalAmount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Tenor Duration</span>
                    <span className="font-bold text-slate-800">{termMonths} Months</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Annual Rate</span>
                    <span className="font-bold text-emerald-700">{selectedProduct.baseInterestRate}% APR</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Installment Payment</span>
                    <span className="font-bold text-slate-900">{formatTZS(calcPreview.installmentAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Total Obligation</span>
                    <span className="font-bold text-slate-900">{formatTZS(calcPreview.totalPayable)}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-xs text-slate-700 space-y-1">
                  <div>
                    <span className="text-slate-500 font-medium">Stated Purpose:</span> {purpose}
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Settlement Account:</span> {bankName} &bull; {accountNumber} ({accountName})
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Guarantor:</span> {guarantorName} ({guarantorPhone}) &bull; {formatTZS(guarantorAmount)}
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Attached Documents:</span> {documents.length} verified files
                  </div>
                </div>
              </div>

              {/* Borrower Declaration */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
                <span className="font-bold block">Borrower Regulatory Declaration & Consent:</span>
                <p className="leading-relaxed">
                  I hereby declare that all supplied information, employment disclosures, and supporting documentation are true and accurate. I authorize Nexa LMS and its designated credit underwriting officers to verify my credit history, bank statements, and collateral registries.
                </p>
              </div>
            </div>
          )}

          {/* STEP 6: Confirmation & Status Tracker */}
          {currentStep === 6 && submittedApplication && (
            <div className="space-y-5 py-2">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xl mx-auto shadow-2xs">
                  ✓
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  Loan Application Successfully Submitted!
                </h4>
                <p className="text-xs text-slate-500">
                  Application Reference: <span className="font-mono font-bold text-slate-900">{submittedApplication.applicationNumber}</span>
                </p>
              </div>

              {/* Real-time Status Tracker */}
              <ApplicationTimelineTracker
                status={submittedApplication.status}
                submittedAt={submittedApplication.applicationDate}
              />

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                  Underwriting Protocol & Next Steps
                </h5>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-600">
                  <li>Your application has entered the loan officer review queue at Dar es Salaam Central branch.</li>
                  <li>Our credit team will verify uploaded documents and conduct credit risk assessment.</li>
                  <li>You can track progress in real-time or submit additional documents anytime from your Customer Dashboard.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
          {currentStep < 6 ? (
            <>
              <button
                type="button"
                disabled={currentStep === 1 || isSubmitting}
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-30 font-medium"
              >
                &larr; Back
              </button>

              <div className="flex items-center gap-2">
                {currentStep === 5 && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit(true)}
                    className="px-3.5 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                  >
                    Save as Draft
                  </button>
                )}

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
                    className="px-4 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium"
                  >
                    Next &rarr;
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit(false)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm"
                  >
                    {isSubmitting ? 'Submitting to Underwriting...' : 'Submit Application Now &rarr;'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800"
              >
                Close & Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
