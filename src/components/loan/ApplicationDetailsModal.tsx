import React, { useState } from 'react';
import { LoanApplicationDTO } from '../../../shared/types/index.js';
import { formatTZS } from '../../utils/currency.js';
import { ApplicationTimelineTracker } from './ApplicationTimelineTracker.js';
import { api } from '../../services/api.js';

interface ApplicationDetailsModalProps {
  application: LoanApplicationDTO;
  onClose: () => void;
  onRefresh: () => void;
}

export const ApplicationDetailsModal: React.FC<ApplicationDetailsModalProps> = ({
  application,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'details' | 'documents' | 'notes'>('tracker');
  const [uploadDocType, setUploadDocType] = useState('Additional Supporting Document');
  const [uploadDocName, setUploadDocName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleUploadAdditionalDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDocName.trim()) return;

    setIsUploading(true);
    try {
      await api.applications.addDocument(application.id, {
        documentType: uploadDocType,
        documentName: uploadDocName.trim().endsWith('.pdf') ? uploadDocName.trim() : `${uploadDocName.trim()}.pdf`,
        fileSize: '1.5 MB',
        fileUrl: `/uploads/${Date.now()}_supp.pdf`,
      });
      setUploadDocName('');
      setMessage('Additional document uploaded successfully.');
      onRefresh();
    } catch (err) {
      setMessage((err as Error).message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col text-xs animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-500 uppercase px-2 py-0.5 bg-slate-100 rounded">
                {application.applicationNumber}
              </span>
              <h3 className="text-base font-bold text-slate-900">
                {application.loanProduct?.name || 'Credit Facility Application'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Requested: <span className="font-mono font-bold text-slate-800">{formatTZS(application.requestedAmount)}</span> &bull; Tenor: {application.requestedTermMonths} Months
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1">
            &times;
          </button>
        </div>

        {message && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="font-bold ml-2 text-emerald-700">&times;</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'tracker'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Status Pipeline Tracker
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Facility Terms & Info
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Documents ({application.documents.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'notes'
                ? 'border-indigo-900 text-indigo-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Officer Communications ({application.notes.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activeTab === 'tracker' && (
            <div className="space-y-4">
              <ApplicationTimelineTracker
                status={application.status}
                submittedAt={application.applicationDate}
                approvalDate={application.approvalDate}
                rejectionDate={application.rejectionDate}
                rejectionReason={application.rejectionReason}
                disbursedAt={application.disbursedAt}
              />

              {application.approvalNotes && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 space-y-1">
                  <span className="font-bold">Official Approval Terms:</span>
                  <p>{application.approvalNotes}</p>
                  <div className="font-mono text-[11px] pt-1">
                    Approved Amount: <span className="font-bold">{formatTZS(application.approvedAmount)}</span> &bull; Rate: {application.approvedInterestRate}% APR
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Financial Application Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Requested Capital</span>
                    <span className="font-bold text-slate-900">{formatTZS(application.requestedAmount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Tenor Duration</span>
                    <span className="font-bold text-slate-900">{application.requestedTermMonths} Months</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Frequency</span>
                    <span className="font-bold text-slate-900">{application.repaymentFrequency}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase font-sans">Annual Rate</span>
                    <span className="font-bold text-emerald-700">{application.loanProduct?.baseInterestRate || 10}% APR</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 text-slate-700">
                  <span className="text-slate-500 font-medium">Stated Purpose:</span> {application.purpose}
                </div>
              </div>

              {/* Borrower & Employment Info */}
              {application.employmentInfo && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Employment & Operating Income
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>Employer: <span className="font-semibold text-slate-800">{application.employmentInfo.employerName}</span></div>
                    <div>Position: <span className="font-semibold text-slate-800">{application.employmentInfo.jobTitle}</span></div>
                    <div>Monthly Income: <span className="font-mono font-semibold text-slate-800">{formatTZS(application.employmentInfo.monthlyIncome)}</span></div>
                    <div>Type: <span className="font-semibold text-slate-800">{application.employmentInfo.employmentType}</span></div>
                  </div>
                </div>
              )}

              {/* Settlement Bank Details */}
              {application.bankDetails && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                    Disbursement & Settlement Account
                  </h4>
                  <div className="grid grid-cols-3 gap-2 font-mono">
                    <div>Bank: <span className="font-semibold text-slate-800">{application.bankDetails.bankName}</span></div>
                    <div>Account #: <span className="font-semibold text-slate-800">{application.bankDetails.accountNumber}</span></div>
                    <div>Name: <span className="font-semibold text-slate-800">{application.bankDetails.accountName}</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                    <tr>
                      <th className="py-2.5 px-3">Document Category</th>
                      <th className="py-2.5 px-3">File Name</th>
                      <th className="py-2.5 px-3 text-right">Size</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {application.documents.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-sans font-semibold text-slate-800">{d.documentType}</td>
                        <td className="py-2 px-3 text-slate-700">{d.documentName}</td>
                        <td className="py-2 px-3 text-right text-slate-400">{d.fileSize || '1.5 MB'}</td>
                        <td className="py-2 px-3 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              d.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {d.verified ? 'VERIFIED' : 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Upload Additional Document */}
              <form onSubmit={handleUploadAdditionalDoc} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Upload Additional Document or Requested Records
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  >
                    <option value="Updated Bank Statement">Updated Bank Statement</option>
                    <option value="Tax Clearance Certificate">Tax Clearance Certificate</option>
                    <option value="Guarantor Proof of Income">Guarantor Proof of Income</option>
                    <option value="Additional Collateral Document">Additional Collateral Document</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Document description / file name"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded font-medium hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Attachment'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-3">
              {application.notes.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No internal review notes recorded for this application.
                </div>
              ) : (
                application.notes.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-900">
                        {n.authorName} <span className="font-mono text-slate-400 font-normal">({n.authorRole})</span>
                      </span>
                      <span className="text-slate-400 font-mono">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed text-[11px]">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
