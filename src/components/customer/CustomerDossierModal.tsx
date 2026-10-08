import React, { useState, useEffect } from 'react';
import {
  CustomerDTO,
  CustomerDocumentDTO,
  DocumentType,
  KycStatus,
  ProfileStatus,
} from '../../../shared/types/index.js';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';

interface CustomerDossierModalProps {
  customerId: string;
  onClose: () => void;
  onCustomerUpdated: (customer: CustomerDTO) => void;
  onOpenEdit: (customer: CustomerDTO) => void;
}

export const CustomerDossierModal: React.FC<CustomerDossierModalProps> = ({
  customerId,
  onClose,
  onCustomerUpdated,
  onOpenEdit,
}) => {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('customer.update');
  const canDelete = hasPermission('customer.delete');

  const [customer, setCustomer] = useState<CustomerDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'profile' | 'financial' | 'loans' | 'repayments' | 'documents' | 'compliance'
  >('profile');

  // Document Management States
  const [showAddDocModal, setShowAddDocModal] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDocData, setNewDocData] = useState({
    documentType: 'NATIONAL_ID' as DocumentType,
    documentName: '',
    fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=800',
    fileSizeBytes: 2450000,
    mimeType: 'application/pdf',
  });

  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  // KYC Management States
  const [selectedKycStatus, setSelectedKycStatus] = useState<KycStatus>('VERIFIED');
  const [kycNotes, setKycNotes] = useState('');
  const [isUpdatingKyc, setIsUpdatingKyc] = useState(false);

  // Profile Status Management States
  const [selectedProfileStatus, setSelectedProfileStatus] = useState<ProfileStatus>('ACTIVE');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const fetchFullCustomer = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const full = await api.customers.getById(customerId);
      setCustomer(full);
      setSelectedKycStatus(full.kycStatus);
      setSelectedProfileStatus(full.profileStatus);
    } catch (err) {
      setError((err as Error).message || 'Failed to load customer dossier');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFullCustomer();
  }, [customerId]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setIsUploadingDoc(true);
    setError(null);

    try {
      await api.customers.addDocument(customer.id, {
        documentType: newDocData.documentType,
        documentName: newDocData.documentName || `${newDocData.documentType.replace('_', ' ')} Document`,
        fileUrl: newDocData.fileUrl,
        fileSizeBytes: newDocData.fileSizeBytes,
        mimeType: newDocData.mimeType,
      });

      setActionSuccess('Document successfully added to borrower compliance vault.');
      setShowAddDocModal(false);
      setNewDocData({
        documentType: 'NATIONAL_ID',
        documentName: '',
        fileUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=800',
        fileSizeBytes: 2450000,
        mimeType: 'application/pdf',
      });
      await fetchFullCustomer();
    } catch (err) {
      setError((err as Error).message || 'Failed to add document');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleVerifyDocument = async (docId: string, status: 'VERIFIED' | 'REJECTED') => {
    if (!customer) return;
    setError(null);
    try {
      await api.customers.verifyDocument(customer.id, docId, {
        verificationStatus: status,
        rejectionReason: status === 'REJECTED' ? rejectReason.trim() || 'Document does not meet authenticity criteria' : undefined,
      });
      setActionSuccess(`Document marked as ${status}`);
      setVerifyingDocId(null);
      setShowRejectInput(false);
      setRejectReason('');
      await fetchFullCustomer();
    } catch (err) {
      setError((err as Error).message || 'Failed to verify document');
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!customer) return;
    if (!window.confirm('Are you sure you want to delete this document from the borrower vault?')) return;
    setError(null);
    try {
      await api.customers.deleteDocument(customer.id, docId);
      setActionSuccess('Document removed from compliance repository.');
      await fetchFullCustomer();
    } catch (err) {
      setError((err as Error).message || 'Failed to delete document');
    }
  };

  const handleKycStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!kycNotes.trim()) {
      setError('Please provide notes explaining the KYC review verdict.');
      return;
    }
    setIsUpdatingKyc(true);
    setError(null);
    try {
      const updated = await api.customers.updateKycStatus(customer.id, {
        kycStatus: selectedKycStatus,
        notes: kycNotes.trim(),
      });
      setCustomer(updated);
      onCustomerUpdated(updated);
      setActionSuccess(`KYC Status successfully updated to ${selectedKycStatus}.`);
      setKycNotes('');
    } catch (err) {
      setError((err as Error).message || 'Failed to update KYC status');
    } finally {
      setIsUpdatingKyc(false);
    }
  };

  const handleProfileStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!statusReason.trim()) {
      setError('An audit reason is required when modifying profile status.');
      return;
    }
    setIsUpdatingStatus(true);
    setError(null);
    try {
      const updated = await api.customers.updateStatus(customer.id, {
        status: selectedProfileStatus,
        reason: statusReason.trim(),
      });
      setCustomer(updated);
      onCustomerUpdated(updated);
      setActionSuccess(`Profile status changed to ${selectedProfileStatus}.`);
      setStatusReason('');
    } catch (err) {
      setError((err as Error).message || 'Failed to update profile status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading && !customer) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-sm w-full text-center space-y-3">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-700">Loading comprehensive customer dossier...</p>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  const fin = customer.financialSummary || {
    totalLoans: 0,
    activeLoans: 0,
    completedLoans: 0,
    totalBorrowed: 0,
    totalRepaid: 0,
    outstandingBalance: 0,
    overdueBalance: 0,
  };

  const loans = customer.loans || [];
  const payments = customer.payments || [];
  const documents = customer.documents || [];

  const repaymentPercentage =
    fin.totalBorrowed > 0 ? Math.min(100, Math.round((fin.totalRepaid / fin.totalBorrowed) * 100)) : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[94vh] flex flex-col animate-in fade-in zoom-in duration-150">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {customer.photoUrl ? (
                <img
                  src={customer.photoUrl}
                  alt={customer.firstName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : null}
              {(!customer.photoUrl || !customer.photoUrl.trim()) && (
                <div className="w-14 h-14 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-lg border-2 border-slate-200 shadow-sm">
                  {customer.firstName[0]}
                  {customer.lastName[0]}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                  customer.profileStatus === 'ACTIVE'
                    ? 'bg-emerald-500'
                    : customer.profileStatus === 'SUSPENDED'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                title={`Status: ${customer.profileStatus}`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {customer.firstName} {customer.middleName ? `${customer.middleName} ` : ''}
                  {customer.lastName}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium">
                  {customer.customerNumber}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                <span>{customer.branch?.name || 'Seattle Main Branch'}</span>
                <span>&bull;</span>
                <span>Registered: {new Date(customer.createdAt || Date.now()).toLocaleDateString()}</span>
                <span>&bull;</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-[10px] ${
                    customer.kycStatus === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : customer.kycStatus === 'UNDER_REVIEW'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  KYC: {customer.kycStatus}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded font-semibold text-[10px] ${
                    customer.profileStatus === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  Profile: {customer.profileStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {canUpdate && (
              <button
                onClick={() => onOpenEdit(customer)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
              >
                Edit Profile
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              Close Dossier
            </button>
          </div>
        </div>

        {/* Feedback alerts */}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg">
            {error}
          </div>
        )}
        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
            <span>{actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold ml-2">
              &times;
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 text-xs overflow-x-auto gap-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'profile'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Profile & Demographics
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'financial'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Financial Summary
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'loans'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Loan Facilities ({loans.length})
          </button>
          <button
            onClick={() => setActiveTab('repayments')}
            className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'repayments'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Repayment Ledger ({payments.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'documents'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Document Vault ({documents.length})
          </button>
          {canUpdate && (
            <button
              onClick={() => setActiveTab('compliance')}
              className={`pb-2.5 font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === 'compliance'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              KYC & Status Control
            </button>
          )}
        </div>

        {/* Tab Content Panes */}
        <div className="flex-1 overflow-y-auto pr-1 text-xs">
          {/* TAB 1: Profile & Demographics */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Identification & Demographics */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
                    Identification & Demographics
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px]">National ID Type</span>
                      <span className="font-semibold text-slate-900">{customer.idType.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ID Document Number</span>
                      <span className="font-mono font-semibold text-slate-900">{customer.idNumber}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Date of Birth</span>
                      <span className="font-medium text-slate-900">
                        {customer.dateOfBirth ? customer.dateOfBirth.split('T')[0] : '1990-01-01'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Gender / Marital</span>
                      <span className="font-medium text-slate-900">
                        {customer.gender || '—'} / {customer.maritalStatus || 'Single'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Issue Date</span>
                      <span className="font-mono text-slate-700">
                        {customer.idIssueDate ? customer.idIssueDate.split('T')[0] : 'On Record'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Expiry Date</span>
                      <span className="font-mono text-slate-700">
                        {customer.idExpiryDate ? customer.idExpiryDate.split('T')[0] : 'Sovereign / Indefinite'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact & Residential Address */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
                    Contact & Residential Address
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Email Address</span>
                      <span className="font-medium text-slate-900">{customer.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Primary Phone</span>
                      <span className="font-mono font-medium text-slate-900">{customer.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Alternate Phone</span>
                      <span className="font-mono text-slate-700">{customer.alternatePhone || 'None specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Address Line 1</span>
                      <span className="font-medium text-slate-900">{customer.addressLine1 || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">City & State</span>
                      <span className="font-medium text-slate-900">
                        {customer.city || 'Seattle'}, {customer.state || 'WA'} {customer.postalCode || '98101'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Country Jurisdiction</span>
                      <span className="font-medium text-slate-900">{customer.country || 'United States'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Employment, Business & Emergency Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Employment & Business Information */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
                    Employment & Business Information
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Employment Type</span>
                      <span className="font-medium text-slate-900">
                        {customer.employmentType.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Designation / Job Title</span>
                      <span className="font-semibold text-slate-900">{customer.jobTitle || 'Officer / Specialist'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Employer / Organization</span>
                      <span className="font-medium text-slate-900">{customer.employerName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Business Entity Name</span>
                      <span className="font-medium text-slate-900">{customer.businessName || 'N/A (Individual)'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Stated Monthly Income</span>
                      <span className="font-mono font-bold text-slate-900">
                        ${customer.monthlyIncome.toLocaleString()} / mo
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Annualized Run-Rate</span>
                      <span className="font-mono font-bold text-slate-900">
                        ${(customer.monthlyIncome * 12).toLocaleString()} / yr
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Credit Bureau Score</span>
                      <span className="font-mono font-bold text-slate-900">
                        {customer.creditScore ? `${customer.creditScore} (Equifax/Experian)` : '720 (Prime standard)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Assigned Branch Facility</span>
                      <span className="font-medium text-slate-900">
                        {customer.branch?.name || 'Seattle Commercial Center'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact & Next of Kin */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-lg p-4 space-y-3">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
                    Emergency Contact & Next of Kin
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Contact Full Name</span>
                      <span className="font-semibold text-slate-900">
                        {customer.emergencyContactName || 'Elena Mercer'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Relationship</span>
                      <span className="font-medium text-slate-900">
                        {customer.emergencyContactRelationship || 'Spouse / Family Contact'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px]">Emergency Phone Number</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {customer.emergencyContactPhone || '+1 (555) 019-4488'}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded text-slate-500 text-[11px] mt-2">
                    Emergency contact information is verified annually under Nexa Financial prudential compliance
                    guidelines.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Financial Summary */}
          {activeTab === 'financial' && (
            <div className="space-y-5">
              {/* 7 KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[11px] font-medium text-slate-500 block">Total Facilities</span>
                  <span className="text-lg font-bold text-slate-900 font-mono mt-1 block">
                    {fin.totalLoans}
                  </span>
                  <span className="text-[10px] text-slate-400">All registered facilities</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[11px] font-medium text-slate-500 block">Active Loans</span>
                  <span className="text-lg font-bold text-blue-700 font-mono mt-1 block">
                    {fin.activeLoans}
                  </span>
                  <span className="text-[10px] text-slate-400">Currently amortizing</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[11px] font-medium text-slate-500 block">Completed Loans</span>
                  <span className="text-lg font-bold text-emerald-700 font-mono mt-1 block">
                    {fin.completedLoans}
                  </span>
                  <span className="text-[10px] text-slate-400">Fully paid & discharged</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[11px] font-medium text-slate-500 block">Total Borrowed</span>
                  <span className="text-lg font-bold text-slate-900 font-mono mt-1 block">
                    ${fin.totalBorrowed.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">Cumulative principal</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[11px] font-medium text-slate-500 block">Total Repaid</span>
                  <span className="text-lg font-bold text-emerald-700 font-mono mt-1 block">
                    ${fin.totalRepaid.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">Principal + interest paid</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-[11px] font-medium text-slate-500 block">Outstanding Balance</span>
                  <span className="text-lg font-bold text-slate-900 font-mono mt-1 block">
                    ${fin.outstandingBalance.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">Remaining capital at risk</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 col-span-2">
                  <span className="text-[11px] font-medium text-slate-500 block">Overdue Arrears</span>
                  <span
                    className={`text-lg font-bold font-mono mt-1 block ${
                      fin.overdueBalance > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    ${fin.overdueBalance.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {fin.overdueBalance > 0 ? 'Immediate collection action required' : 'Account current & compliant'}
                  </span>
                </div>
              </div>

              {/* Progress & Debt Ratio */}
              <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Repayment Discharge Ratio</span>
                  <span className="font-mono font-bold text-slate-900">{repaymentPercentage}% Paid</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${repaymentPercentage}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 text-[11px] text-slate-500 pt-1">
                  <span>${fin.totalRepaid.toLocaleString()} satisfied</span>
                  <span className="text-right">${fin.outstandingBalance.toLocaleString()} remaining balance</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <span className="font-semibold text-slate-900 block">Debt-to-Income (DTI) Assessment</span>
                  <p className="text-slate-600 text-[11px]">
                    Monthly debt service run-rate is appraised against stated income of ${customer.monthlyIncome.toLocaleString()}.
                  </p>
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    {customer.monthlyIncome > 0
                      ? `${Math.round(((fin.outstandingBalance * 0.05) / customer.monthlyIncome) * 100)}% Estimated DTI`
                      : 'N/A'}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <span className="font-semibold text-slate-900 block">Credit Facility Grade</span>
                  <p className="text-slate-600 text-[11px]">
                    Determined by institutional scoring algorithms and historical arrears patterns.
                  </p>
                  <div className="font-bold text-emerald-700 text-sm">
                    {customer.creditScore && customer.creditScore >= 750
                      ? 'Tier 1 Prime Sovereign Grade'
                      : customer.creditScore && customer.creditScore >= 670
                      ? 'Tier 2 Near-Prime Low Risk'
                      : 'Tier 3 Standard Credit Facility'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Loan Facilities */}
          {activeTab === 'loans' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                  Registered Credit Facilities ({loans.length})
                </h4>
              </div>

              {loans.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700">No loan facilities registered for this customer.</p>
                  <p className="text-[11px]">Borrower is eligible to submit a new loan application.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <th className="py-2 px-3">Loan Account</th>
                        <th className="py-2 px-3">Product Name</th>
                        <th className="py-2 px-3 text-right">Principal</th>
                        <th className="py-2 px-3 text-right">Balance</th>
                        <th className="py-2 px-3 text-center">Rate / Term</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Disbursed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            {loan.loanNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">
                            {loan.product?.name || 'Commercial Facility'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-900">
                            ${loan.principalAmount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${loan.remainingBalance.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {loan.interestRate}% &bull; {loan.termMonths}m
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                loan.status === 'ACTIVE' || loan.status === 'DISBURSED'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : loan.status === 'CLOSED' || loan.status === 'CLOSED_PAID_OFF'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : loan.status === 'IN_ARREARS'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {loan.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                            {loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString() : 'Pending'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Repayment Ledger */}
          {activeTab === 'repayments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                  Historical Cashier & Wire Repayment Transactions ({payments.length})
                </h4>
              </div>

              {payments.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700">No repayment transactions recorded for this customer.</p>
                  <p className="text-[11px]">Payments recorded via Cashier Desk will appear here in real-time.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                        <th className="py-2 px-3">Receipt / Ref No.</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">Payment Channel</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Reference / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                            {p.receiptNumber || p.id}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {new Date(p.paymentDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                            ${p.amount.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-700">
                            {(p.method || 'CASH').replace('_', ' ')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                p.status === 'FULLY_ALLOCATED' || (p.status as string) === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : p.status === 'REVERSED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {p.transactionRef || p.notes || 'Amortization schedule reduction'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Document Vault (Document Management) */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px]">
                    Borrower Compliance & KYC Document Vault
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Verified certificates, photo IDs, bank statements, and collateral deeds
                  </p>
                </div>
                {canUpdate && (
                  <button
                    onClick={() => setShowAddDocModal(true)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    + Upload New Document
                  </button>
                )}
              </div>

              {documents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-lg text-slate-500 space-y-2">
                  <p className="font-medium text-slate-700">No compliance documents attached to this dossier.</p>
                  <p className="text-[11px]">Click "Upload New Document" to register passports, bank statements, or utility bills.</p>
                  {canUpdate && (
                    <button
                      onClick={() => setShowAddDocModal(true)}
                      className="mt-2 px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-100"
                    >
                      + Add Primary Identification
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2 hover:border-slate-300 transition-colors shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700 font-semibold">
                            {doc.documentType.replace('_', ' ')}
                          </span>
                          <h5 className="font-bold text-slate-900 text-xs leading-snug">
                            {doc.documentName}
                          </h5>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            {(doc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB &bull; {doc.mimeType} &bull; Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                            doc.verificationStatus === 'VERIFIED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : doc.verificationStatus === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {doc.verificationStatus}
                        </span>
                      </div>

                      {doc.verifiedByStaffName && (
                        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                          <strong>Verified by:</strong> {doc.verifiedByStaffName} on{' '}
                          {doc.verifiedAt ? new Date(doc.verifiedAt).toLocaleDateString() : '—'}
                        </div>
                      )}

                      {doc.rejectionReason && (
                        <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded border border-rose-100">
                          <strong>Rejection reason:</strong> {doc.rejectionReason}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                        >
                          View Original &rarr;
                        </a>

                        <div className="flex items-center gap-2">
                          {canUpdate && doc.verificationStatus !== 'VERIFIED' && (
                            <button
                              onClick={() => handleVerifyDocument(doc.id, 'VERIFIED')}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-[11px] font-medium hover:bg-emerald-100"
                            >
                              Verify
                            </button>
                          )}

                          {canUpdate && doc.verificationStatus !== 'REJECTED' && (
                            <button
                              onClick={() => {
                                setVerifyingDocId(doc.id);
                                setShowRejectInput(true);
                              }}
                              className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-300 rounded text-[11px] font-medium hover:bg-rose-100"
                            >
                              Reject
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-slate-400 hover:text-rose-600 text-xs px-1"
                              title="Delete Document"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>

                      {showRejectInput && verifyingDocId === doc.id && (
                        <div className="p-2.5 bg-rose-50/80 border border-rose-200 rounded-lg space-y-2 mt-2">
                          <label className="block text-[11px] font-medium text-rose-900">
                            Specify Rejection Reason:
                          </label>
                          <input
                            type="text"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g. Blurred photocopy / Expired document / Unreadable seal"
                            className="w-full px-2 py-1 border border-rose-300 rounded text-xs bg-white focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowRejectInput(false);
                                setVerifyingDocId(null);
                              }}
                              className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleVerifyDocument(doc.id, 'REJECTED')}
                              className="px-2 py-0.5 text-xs bg-rose-600 text-white rounded font-medium hover:bg-rose-700"
                            >
                              Confirm Rejection
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: KYC & Status Control */}
          {activeTab === 'compliance' && canUpdate && (
            <div className="space-y-6">
              {/* KYC Status Form */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Institutional KYC Clearance Decision
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Updates borrower eligibility status for underwriting and disbursement.
                  </p>
                </div>

                <form onSubmit={handleKycStatusUpdate} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Select New KYC Status
                      </label>
                      <select
                        value={selectedKycStatus}
                        onChange={(e) => setSelectedKycStatus(e.target.value as KycStatus)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      >
                        <option value="VERIFIED">VERIFIED (Eligible for loan approval & disbursement)</option>
                        <option value="UNDER_REVIEW">UNDER_REVIEW (Pending senior compliance sign-off)</option>
                        <option value="PENDING">PENDING (Awaiting applicant documentation)</option>
                        <option value="REJECTED">REJECTED (Failed AML/OFAC/Identity screening)</option>
                        <option value="EXPIRED">EXPIRED (Periodic re-certification required)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Compliance Appraisal Notes <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={kycNotes}
                        onChange={(e) => setKycNotes(e.target.value)}
                        placeholder="e.g. Identity and address certified against sovereign databases"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isUpdatingKyc}
                      className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 text-xs shadow-xs"
                    >
                      {isUpdatingKyc ? 'Updating KYC...' : 'Update KYC Status'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Profile Activation Form */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Customer Account Lifecycle & Activation Control
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Activate, suspend, or blacklist borrower account access across all branch touchpoints.
                  </p>
                </div>

                <form onSubmit={handleProfileStatusUpdate} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Select Profile Activation Status
                      </label>
                      <select
                        value={selectedProfileStatus}
                        onChange={(e) => setSelectedProfileStatus(e.target.value as ProfileStatus)}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      >
                        <option value="ACTIVE">ACTIVE (Authorized for ongoing facilities)</option>
                        <option value="INACTIVE">INACTIVE (Dormant profile)</option>
                        <option value="SUSPENDED">SUSPENDED (Temporary freeze on all withdrawals/loans)</option>
                        <option value="BLACKLISTED">BLACKLISTED (High-risk or adverse AML finding)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Mandatory Audit Reason <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={statusReason}
                        onChange={(e) => setStatusReason(e.target.value)}
                        placeholder="e.g. Scheduled customer profile reactivation after document renewal"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isUpdatingStatus}
                      className={`px-4 py-1.5 text-white rounded-lg font-medium disabled:opacity-50 text-xs shadow-xs transition-colors ${
                        selectedProfileStatus === 'ACTIVE'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : selectedProfileStatus === 'BLACKLISTED'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {isUpdatingStatus ? 'Updating Status...' : `Set as ${selectedProfileStatus}`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
          <span className="text-slate-400 font-mono">
            System ID: {customer.id} &bull; Security Protocol: RBAC-Enforced
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
          >
            Done
          </button>
        </div>
      </div>

      {/* Upload Document Sub-Modal */}
      {showAddDocModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-60">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add Customer Compliance Document</h3>
              <button
                onClick={() => setShowAddDocModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Document Classification <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newDocData.documentType}
                  onChange={(e) =>
                    setNewDocData({ ...newDocData, documentType: e.target.value as DocumentType })
                  }
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="NATIONAL_ID">National ID / Social Security Card</option>
                  <option value="PASSPORT">Passport Bio Page</option>
                  <option value="PROOF_OF_RESIDENCE">Proof of Residence (Utility Bill)</option>
                  <option value="PAYSLIP">Salary / Pay Slip</option>
                  <option value="BANK_STATEMENT">Bank Statement (6 Months)</option>
                  <option value="BUSINESS_REGISTRATION">Business Registration / Articles of Incorporation</option>
                  <option value="TAX_RETURN">Official Tax Return</option>
                  <option value="COLLATERAL_TITLE_DEED">Collateral Title Deed</option>
                  <option value="VEHICLE_LOGBOOK">Vehicle Logbook</option>
                  <option value="GUARANTOR_FORM">Guarantor Commitment Form</option>
                  <option value="OTHER">Other Supporting Document</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Document Title / Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDocData.documentName}
                  onChange={(e) => setNewDocData({ ...newDocData, documentName: e.target.value })}
                  placeholder="e.g. Q1 2026 Commercial Bank Statement"
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Document Secure File URL / Storage URI <span className="text-rose-500">*</span>
                </label>
                <input
                  type="url"
                  required
                  value={newDocData.fileUrl}
                  onChange={(e) => setNewDocData({ ...newDocData, fileUrl: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">MIME File Type</label>
                  <select
                    value={newDocData.mimeType}
                    onChange={(e) => setNewDocData({ ...newDocData, mimeType: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-mono"
                  >
                    <option value="application/pdf">application/pdf</option>
                    <option value="image/jpeg">image/jpeg</option>
                    <option value="image/png">image/png</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Approximate File Size (KB)</label>
                  <input
                    type="number"
                    value={Math.round(newDocData.fileSizeBytes / 1024)}
                    onChange={(e) =>
                      setNewDocData({ ...newDocData, fileSizeBytes: Number(e.target.value) * 1024 })
                    }
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDocModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {isUploadingDoc ? 'Saving Document...' : 'Attach to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
