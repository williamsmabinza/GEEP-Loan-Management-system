import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { LoanProductDTO } from '../../shared/types/index.js';
import { StatCard } from '../components/common/StatCard.js';
import { LoanProductFormModal } from '../components/loan/LoanProductFormModal.js';
import { LoanCalculatorWidget } from '../components/loan/LoanCalculatorWidget.js';
import { formatTZS } from '../utils/currency.js';

export const LoanProductsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings.update') || hasPermission('loan.create');

  const [products, setProducts] = useState<LoanProductDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [formModalState, setFormModalState] = useState<{
    isOpen: boolean;
    product?: LoanProductDTO | null;
  }>({ isOpen: false, product: null });

  const [calculatorState, setCalculatorState] = useState<{
    isOpen: boolean;
    initialProductId?: string;
  }>({ isOpen: false, initialProductId: undefined });

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.products.getAll(true);
      setProducts(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch loan products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleToggleStatus = async (product: LoanProductDTO) => {
    const nextStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setError(null);
    try {
      const updated = await api.products.toggleStatus(product.id, nextStatus);
      setSuccessMsg(`Product ${product.name} is now ${nextStatus}.`);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError((err as Error).message || 'Failed to update product status');
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!window.confirm(`Are you certain you wish to delete credit product "${name}"? This action is audited.`)) {
      return;
    }
    setError(null);
    try {
      await api.products.delete(id);
      setSuccessMsg(`Product ${name} deleted successfully.`);
      fetchProducts();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete product');
    }
  };

  const filteredProducts = products.filter((p) => {
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchCode = p.code.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q) || false;
      return matchName || matchCode || matchDesc;
    }
    return true;
  });

  const activeProducts = products.filter((p) => p.status === 'ACTIVE');
  const lowestRate = products.length > 0 ? Math.min(...products.map((p) => p.baseInterestRate)) : 0;
  const maxLimit = products.length > 0 ? Math.max(...products.map((p) => p.maxAmount)) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Institutional Loan Products & Rate Matrices
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure lending facilities, actuarial interest methods, fee structures, tenor limits, and risk boundaries
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCalculatorState({ isOpen: true })}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5"
          >
            <span>🧮</span>
            <span>Open Loan Calculator</span>
          </button>

          {canManage && (
            <button
              onClick={() => setFormModalState({ isOpen: true, product: null })}
              className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              + Create Loan Product
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-700 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 font-bold ml-2">
            &times;
          </button>
        </div>
      )}

      {/* Surveillance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Catalog Products"
          value={products.length.toString()}
          subtext="Total institutional facilities"
        />
        <StatCard
          label="Active Facilities"
          value={activeProducts.length.toString()}
          subtext="Open for borrower applications"
        />
        <StatCard
          label="Lowest Benchmark APR"
          value={`${lowestRate.toFixed(2)}%`}
          subtext="Standard prime rate floor"
        />
        <StatCard
          label="Maximum Credit Line"
          value={formatTZS(maxLimit, { compact: true })}
          subtext="Institutional balance ceiling"
        />
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search products by code, facility name, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none w-full sm:w-80"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white font-medium"
          >
            <option value="ALL">All Statuses ({products.length})</option>
            <option value="ACTIVE">Active Origination</option>
            <option value="INACTIVE">Inactive / Archived</option>
            <option value="SUSPENDED">Suspended Review</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredProducts.length} of {products.length} facilities
        </div>
      </div>

      {/* Product Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-xl">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading institutional products catalogue...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-xl space-y-2">
          <p className="font-semibold text-slate-800">No loan products match current criteria.</p>
          <p className="text-[11px] text-slate-400">Click "+ Create Loan Product" to configure a new lending facility.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((p) => {
            const isMethodAmortized =
              p.interestCalculationMethod === 'REDUCING_BALANCE_EQUAL_INSTALLMENTS';

            return (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all space-y-4"
              >
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-500 uppercase px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                      {p.code}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : p.status === 'SUSPENDED'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-300'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-500'
                            : p.status === 'SUSPENDED'
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      {p.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 leading-snug">{p.name}</h3>

                  <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                    {p.description || 'Institutional credit facility with configurable underwriting boundaries.'}
                  </p>
                </div>

                {/* Key Metrics Breakdown */}
                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Benchmark Rate:</span>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {p.baseInterestRate}% APR
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Principal Bounds:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {formatTZS(p.minAmount, { compact: true })} – {formatTZS(p.maxAmount, { compact: true })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tenor Range:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {p.minTermMonths} – {p.maxTermMonths} Months
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Repayment Mode:</span>
                    <span className="font-medium text-slate-700">{p.repaymentFrequency}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Calculation Method:</span>
                    <span
                      className="font-medium text-[11px] text-slate-800 max-w-[180px] text-right truncate"
                      title={String(p.interestCalculationMethod)}
                    >
                      {String(p.interestCalculationMethod).replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-50">
                    <span>Fees: Proc {p.processingFeeValue}% &bull; Ins {p.insuranceFeeValue || 0}%</span>
                    <span>Grace: {p.gracePeriodDays} days</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => setCalculatorState({ isOpen: true, initialProductId: p.id })}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-medium text-[11px] transition-colors flex items-center gap-1"
                  >
                    <span>🧮</span>
                    <span>Simulate</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {canManage && (
                      <>
                        <button
                          onClick={() => setFormModalState({ isOpen: true, product: p })}
                          className="px-2.5 py-1 border border-slate-300 text-slate-700 rounded text-[11px] hover:bg-slate-50 font-medium transition-colors"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleToggleStatus(p)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                            p.status === 'ACTIVE'
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {p.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>

                        <button
                          onClick={() => handleDeleteProduct(p.id, p.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded text-sm transition-colors leading-none"
                          title="Delete Product"
                        >
                          &times;
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Loan Calculator Section (Embedded on page) */}
      <div className="pt-4">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <h2 className="text-base font-bold text-slate-900">
            Interactive Institutional Calculator Engine
          </h2>
          <p className="text-xs text-slate-500">
            Test any product configuration or custom terms with live amortization schedules and decimal-safe calculations
          </p>
        </div>
        <LoanCalculatorWidget products={products} />
      </div>

      {/* Modal 1: Create / Edit Loan Product */}
      {formModalState.isOpen && (
        <LoanProductFormModal
          product={formModalState.product}
          onClose={() => setFormModalState({ isOpen: false, product: null })}
          onSuccess={(saved) => {
            setSuccessMsg(
              formModalState.product
                ? `Loan product "${saved.name}" updated successfully.`
                : `Loan product "${saved.name}" created and published.`
            );
            fetchProducts();
          }}
        />
      )}

      {/* Modal 2: Loan Calculator Modal */}
      {calculatorState.isOpen && (
        <LoanCalculatorWidget
          products={products}
          initialProductId={calculatorState.initialProductId}
          isModal={true}
          onClose={() => setCalculatorState({ isOpen: false })}
        />
      )}
    </div>
  );
};
