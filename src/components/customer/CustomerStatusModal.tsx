import React, { useState } from 'react';
import { CustomerDTO, ProfileStatus } from '../../../shared/types/index.js';
import { api } from '../../services/api.js';

interface CustomerStatusModalProps {
  customer: CustomerDTO;
  onClose: () => void;
  onSuccess: (updated: CustomerDTO) => void;
}

export const CustomerStatusModal: React.FC<CustomerStatusModalProps> = ({
  customer,
  onClose,
  onSuccess,
}) => {
  const [status, setStatus] = useState<ProfileStatus>(
    customer.profileStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  );
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('An audit reason must be stated for compliance logs.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await api.customers.updateStatus(customer.id, {
        status,
        reason: reason.trim(),
      });
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to update customer status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Update Profile Activation Status
            </h3>
            <p className="text-xs text-slate-500">
              {customer.firstName} {customer.lastName} ({customer.customerNumber})
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

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Select New Profile Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProfileStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white font-medium"
            >
              <option value="ACTIVE">ACTIVE (Authorized for new credit facilities)</option>
              <option value="INACTIVE">INACTIVE (Dormant profile)</option>
              <option value="SUSPENDED">SUSPENDED (Pending compliance investigation)</option>
              <option value="BLACKLISTED">BLACKLISTED (High-risk or fraudulent entity)</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Compliance Audit Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Periodic KYC re-screening passed / Requested profile deactivation / Arrears follow-up..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Every status modification is permanently recorded in the institutional audit log.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
              className={`px-4 py-1.5 rounded-lg text-white font-medium disabled:opacity-50 transition-colors ${
                status === 'ACTIVE'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : status === 'BLACKLISTED'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isSubmitting ? 'Recording...' : `Set as ${status}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
