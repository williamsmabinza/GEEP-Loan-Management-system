import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { CustomerDTO } from '../../shared/types/index.js';
import { StatCard } from '../components/common/StatCard.js';
import { CustomerDossierModal } from '../components/customer/CustomerDossierModal.js';
import { CustomerFormModal } from '../components/customer/CustomerFormModal.js';
import { CustomerStatusModal } from '../components/customer/CustomerStatusModal.js';
import { formatTZS } from '../utils/currency.js';

export const CustomersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canView = hasPermission('customer.view');
  const canCreate = hasPermission('customer.create');
  const canUpdate = hasPermission('customer.update');
  const canDelete = hasPermission('customer.delete');

  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [kycFilter, setKycFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [dossierCustomerId, setDossierCustomerId] = useState<string | null>(null);
  const [formModalState, setFormModalState] = useState<{
    isOpen: boolean;
    customer?: CustomerDTO | null;
  }>({ isOpen: false, customer: null });
  const [statusModalCustomer, setStatusModalCustomer] = useState<CustomerDTO | null>(null);

  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.customers.getAll();
      setCustomers(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch customer directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!window.confirm(`Are you certain you wish to delete customer record "${name}"? This action will be audited.`)) {
      return;
    }
    setError(null);
    try {
      await api.customers.delete(id);
      setSuccessMsg(`Customer ${name} deleted successfully.`);
      await fetchCustomers();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete customer');
    }
  };

  // Filtered customers
  const filteredCustomers = customers.filter((c) => {
    if (kycFilter !== 'ALL' && c.kycStatus !== kycFilter) return false;
    if (statusFilter !== 'ALL' && c.profileStatus !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q);
      const matchNum = c.customerNumber.toLowerCase().includes(q);
      const matchEmail = c.email.toLowerCase().includes(q);
      const matchPhone = c.phone.toLowerCase().includes(q);
      const matchId = c.idNumber.toLowerCase().includes(q);
      return matchName || matchNum || matchEmail || matchPhone || matchId;
    }
    return true;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Customer Directory & Borrower KYC Vault
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Retail & commercial borrower dossiers, KYC verification statuses, employment metrics, and compliance vaults
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCustomers}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Refresh Vault
          </button>
          {canCreate && (
            <button
              onClick={() => setFormModalState({ isOpen: true, customer: null })}
              className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              + Onboard New Borrower
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
          label="Total Borrowers Registered"
          value={customers.length.toString()}
          subtext="Institutional & retail customer profiles"
        />
        <StatCard
          label="KYC Fully Verified"
          value={customers.filter((c) => c.kycStatus === 'VERIFIED').length.toString()}
          subtext="Cleared for credit disbursement"
        />
        <StatCard
          label="Active Borrowers"
          value={customers.filter((c) => c.profileStatus === 'ACTIVE').length.toString()}
          subtext="Accounts in good standing"
        />
        <StatCard
          label="Avg Borrower Credit Score"
          value={
            customers.length > 0
              ? Math.round(
                  customers.reduce((acc, c) => acc + (c.creditScore || 700), 0) / customers.length
                ).toString()
              : '725'
          }
          subtext="Equifax/Experian benchmark"
        />
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by customer name, number, email, phone, or SSN/ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none w-full sm:w-80"
          />

          <select
            value={kycFilter}
            onChange={(e) => {
              setKycFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white font-medium"
          >
            <option value="ALL">All KYC Statuses</option>
            <option value="VERIFIED">KYC: Verified</option>
            <option value="UNDER_REVIEW">KYC: Under Review</option>
            <option value="PENDING">KYC: Pending</option>
            <option value="REJECTED">KYC: Rejected</option>
            <option value="EXPIRED">KYC: Expired</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white font-medium"
          >
            <option value="ALL">All Profile Statuses</option>
            <option value="ACTIVE">Profile: Active</option>
            <option value="INACTIVE">Profile: Inactive</option>
            <option value="SUSPENDED">Profile: Suspended</option>
            <option value="BLACKLISTED">Profile: Blacklisted</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 border border-slate-300 rounded-lg text-xs bg-white font-mono"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
          <span>
            {filteredCustomers.length} record{filteredCustomers.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Verified Customer Registry
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Prisma relational customer entity with audit tracking
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-500 font-medium">
                <th className="py-2.5 px-4">Borrower / Customer No.</th>
                <th className="py-2.5 px-4">Contact Details</th>
                <th className="py-2.5 px-4">Identification</th>
                <th className="py-2.5 px-4">Employment & Income</th>
                <th className="py-2.5 px-4">Credit Score</th>
                <th className="py-2.5 px-4">KYC Status</th>
                <th className="py-2.5 px-4">Profile Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading customer directory...
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No customers match current criteria.
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {c.photoUrl ? (
                          <img
                            src={c.photoUrl}
                            alt={c.firstName}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : null}
                        {(!c.photoUrl || !c.photoUrl.trim()) && (
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {c.firstName[0]}
                            {c.lastName[0]}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">
                            {c.firstName} {c.lastName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{c.customerNumber}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{c.email}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{c.phone}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{c.idType.replace('_', ' ')}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{c.idNumber}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">
                        {c.jobTitle || c.employerName || c.employmentType.replace('_', ' ')}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {formatTZS(c.monthlyIncome)} / mo
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900 block">
                        {c.creditScore || '—'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {c.creditScore && c.creditScore >= 750
                          ? 'Excellent'
                          : c.creditScore && c.creditScore >= 670
                          ? 'Good'
                          : 'Standard'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          c.kycStatus === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.kycStatus === 'UNDER_REVIEW'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : c.kycStatus === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            c.kycStatus === 'VERIFIED'
                              ? 'bg-emerald-500'
                              : c.kycStatus === 'REJECTED'
                              ? 'bg-rose-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        {c.kycStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          c.profileStatus === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.profileStatus === 'SUSPENDED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {c.profileStatus}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDossierCustomerId(c.id)}
                          className="px-2.5 py-1 bg-slate-900 text-white rounded text-[11px] font-medium hover:bg-slate-800 transition-colors shadow-2xs"
                        >
                          View Dossier
                        </button>

                        {canUpdate && (
                          <button
                            onClick={() => setFormModalState({ isOpen: true, customer: c })}
                            className="px-2 py-1 border border-slate-300 text-slate-700 rounded text-[11px] hover:bg-slate-50 transition-colors"
                            title="Edit Borrower Profile"
                          >
                            Edit
                          </button>
                        )}

                        {canUpdate && (
                          <button
                            onClick={() => setStatusModalCustomer(c)}
                            className="px-2 py-1 border border-slate-300 text-slate-700 rounded text-[11px] hover:bg-slate-50 transition-colors"
                            title="Toggle Activation / Status"
                          >
                            Status
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteCustomer(c.id, `${c.firstName} ${c.lastName}`)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded text-[11px] transition-colors"
                            title="Delete Customer Record"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredCustomers.length > 0 && (
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing{' '}
              <span className="font-semibold text-slate-900">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-slate-900">
                {Math.min(currentPage * pageSize, filteredCustomers.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-900">{filteredCustomers.length}</span>{' '}
              records
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-300 rounded text-slate-700 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent font-medium"
              >
                &larr; Previous
              </button>

              <span className="px-3 py-1 font-mono text-[11px] text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-slate-300 rounded text-slate-700 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent font-medium"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Full Dossier View */}
      {dossierCustomerId && (
        <CustomerDossierModal
          customerId={dossierCustomerId}
          onClose={() => setDossierCustomerId(null)}
          onCustomerUpdated={(updated) => {
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
          onOpenEdit={(c) => {
            setDossierCustomerId(null);
            setFormModalState({ isOpen: true, customer: c });
          }}
        />
      )}

      {/* Modal 2: Create / Edit Customer Form */}
      {formModalState.isOpen && (
        <CustomerFormModal
          customer={formModalState.customer}
          onClose={() => setFormModalState({ isOpen: false, customer: null })}
          onSuccess={(saved) => {
            setSuccessMsg(
              formModalState.customer
                ? `Customer ${saved.firstName} ${saved.lastName} successfully updated.`
                : `Customer ${saved.firstName} ${saved.lastName} successfully onboarded.`
            );
            fetchCustomers();
          }}
        />
      )}

      {/* Modal 3: Status / Activation Change */}
      {statusModalCustomer && (
        <CustomerStatusModal
          customer={statusModalCustomer}
          onClose={() => setStatusModalCustomer(null)}
          onSuccess={(updated) => {
            setSuccessMsg(`Status updated for ${updated.firstName} ${updated.lastName}.`);
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }}
        />
      )}
    </div>
  );
};
