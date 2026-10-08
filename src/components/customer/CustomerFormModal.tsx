import React, { useState } from 'react';
import { CustomerDTO } from '../../../shared/types/index.js';
import { CreateCustomerInput } from '../../../shared/validators/customer.js';
import { api } from '../../services/api.js';

interface CustomerFormModalProps {
  customer?: CustomerDTO | null; // If provided, mode is EDIT; otherwise CREATE
  onClose: () => void;
  onSuccess: (savedCustomer: CustomerDTO) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  customer,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(customer);

  const [activeTab, setActiveTab] = useState<'personal' | 'id_address' | 'employment' | 'emergency'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: customer?.firstName || '',
    middleName: customer?.middleName || '',
    lastName: customer?.lastName || '',
    dateOfBirth: customer?.dateOfBirth ? customer.dateOfBirth.split('T')[0] : '1990-01-01',
    gender: (customer?.gender as any) || 'PREFER_NOT_TO_SAY',
    maritalStatus: (customer?.maritalStatus as any) || 'SINGLE',
    email: customer?.email || '',
    phone: customer?.phone || '',
    alternatePhone: customer?.alternatePhone || '',
    photoUrl: customer?.photoUrl || '',

    idType: (customer?.idType as any) || 'NATIONAL_ID',
    idNumber: customer?.idNumber || '',
    addressLine1: customer?.addressLine1 || '',
    addressLine2: customer?.addressLine2 || '',
    city: customer?.city || 'Seattle',
    state: customer?.state || 'WA',
    postalCode: customer?.postalCode || '98101',
    country: customer?.country || 'US',

    employmentType: (customer?.employmentType as any) || 'FULL_TIME_SALARIED',
    employerName: customer?.employerName || '',
    jobTitle: customer?.jobTitle || '',
    businessName: customer?.businessName || '',
    businessAddress: customer?.businessAddress || '',
    monthlyIncome: customer?.monthlyIncome ?? 7500,
    creditScore: customer?.creditScore ?? 720,

    emergencyContactName: customer?.emergencyContactName || '',
    emergencyContactRelationship: customer?.emergencyContactRelationship || '',
    emergencyContactPhone: customer?.emergencyContactPhone || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const payload: CreateCustomerInput = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        middleName: formData.middleName.trim() || undefined,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        maritalStatus: formData.maritalStatus,
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim() || undefined,
        photoUrl: formData.photoUrl.trim() || undefined,
        idType: formData.idType,
        idNumber: formData.idNumber.trim(),
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim() || undefined,
        country: formData.country.trim() || 'US',
        employmentType: formData.employmentType,
        employerName: formData.employerName.trim() || undefined,
        jobTitle: formData.jobTitle.trim() || undefined,
        businessName: formData.businessName.trim() || undefined,
        businessAddress: formData.businessAddress.trim() || undefined,
        monthlyIncome: Number(formData.monthlyIncome),
        creditScore: formData.creditScore ? Number(formData.creditScore) : undefined,
        emergencyContactName: formData.emergencyContactName.trim() || undefined,
        emergencyContactRelationship: formData.emergencyContactRelationship.trim() || undefined,
        emergencyContactPhone: formData.emergencyContactPhone.trim() || undefined,
      };

      let result: CustomerDTO;
      if (isEdit && customer) {
        result = await api.customers.update(customer.id, payload);
      } else {
        result = await api.customers.create(payload);
      }

      onSuccess(result);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Failed to save customer');
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
              {isEdit ? 'Edit Customer Dossier' : 'Onboard New Credit Customer (KYC)'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEdit
                ? `Modifying verified record for ${customer?.customerNumber}`
                : 'Enter complete demographic, identity, financial, and contact parameters.'}
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

        {/* Form Navigation Tabs */}
        <div className="flex border-b border-slate-200 text-xs gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            className={`pb-2 font-medium border-b-2 transition-colors ${
              activeTab === 'personal'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            1. Personal & Contact
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('id_address')}
            className={`pb-2 font-medium border-b-2 transition-colors ${
              activeTab === 'id_address'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            2. ID & Residence
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('employment')}
            className={`pb-2 font-medium border-b-2 transition-colors ${
              activeTab === 'employment'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            3. Employment & Financial
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emergency')}
            className={`pb-2 font-medium border-b-2 transition-colors ${
              activeTab === 'emergency'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            4. Emergency & Guarantor
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs">
          {/* TAB 1: Personal & Contact */}
          {activeTab === 'personal' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Eleanor"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Vance"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Sterling"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white"
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Marital Status</label>
                  <select
                    value={formData.maritalStatus}
                    onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white"
                  >
                    <option value="SINGLE">Single</option>
                    <option value="MARRIED">Married</option>
                    <option value="DIVORCED">Divorced</option>
                    <option value="WIDOWED">Widowed</option>
                    <option value="SEPARATED">Separated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="customer@domain.com"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Primary Phone <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="+1 (555) 234-5678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="+1 (555) 987-6543 (Optional)"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Profile Photograph URL</label>
                  <input
                    type="url"
                    value={formData.photoUrl}
                    onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="https://images.unsplash.com/... or leave blank"
                  />
                </div>
              </div>

              {formData.photoUrl && (
                <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                  <img
                    src={formData.photoUrl}
                    alt="Preview"
                    className="w-10 h-10 rounded-full object-cover border border-slate-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <span className="text-[11px] text-slate-500">Live photograph preview</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Identification & Address */}
          {activeTab === 'id_address' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    National ID Document Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.idType}
                    onChange={(e) => setFormData({ ...formData, idType: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white font-medium"
                  >
                    <option value="NATIONAL_ID">National ID / Social Security Card</option>
                    <option value="PASSPORT">International Passport</option>
                    <option value="DRIVERS_LICENSE">State Driver's License</option>
                    <option value="TAX_IDENTIFICATION_NUMBER">Tax Identification Number (TIN/EIN)</option>
                    <option value="VOTER_ID">Voter Identification Card</option>
                    <option value="OTHER">Other Sovereign Identification</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Identification Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.idNumber}
                    onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                    placeholder="e.g. SSN-998-21-4321 / P-882910"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Residential Address Line 1 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  placeholder="Street number and street name"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Address Line 2</label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  placeholder="Apt, Suite, Unit, Building (Optional)"
                />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Seattle"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    State / Region <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="WA"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                    placeholder="98101"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Employment & Financial Information */}
          {activeTab === 'employment' && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Employment Type</label>
                  <select
                    value={formData.employmentType}
                    onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white font-medium"
                  >
                    <option value="FULL_TIME_SALARIED">Full-Time Salaried</option>
                    <option value="PART_TIME_SALARIED">Part-Time Salaried</option>
                    <option value="SELF_EMPLOYED">Self-Employed Professional</option>
                    <option value="BUSINESS_OWNER">Enterprise / Business Owner</option>
                    <option value="CONTRACTOR">Independent Contractor</option>
                    <option value="RETIRED">Retired Pensioner</option>
                    <option value="UNEMPLOYED">Unemployed</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Job Title / Role</label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Chief Operating Officer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Employer / Enterprise Name</label>
                  <input
                    type="text"
                    value={formData.employerName}
                    onChange={(e) => setFormData({ ...formData, employerName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Rainier Cloud Technologies"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Registered Business Name (If owner)</label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Pacific Coast Distribution LLC"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Business Operating Address</label>
                <input
                  type="text"
                  value={formData.businessAddress}
                  onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  placeholder="Commercial facility or headquarters address"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Monthly Stated Income ($ USD) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-mono">$</span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={100}
                      value={formData.monthlyIncome}
                      onChange={(e) => setFormData({ ...formData, monthlyIncome: Number(e.target.value) })}
                      className="w-full pl-7 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Credit Bureau Score (FICO / Vantage)
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={850}
                    value={formData.creditScore}
                    onChange={(e) => setFormData({ ...formData, creditScore: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Emergency Contact & Guarantor */}
          {activeTab === 'emergency' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 space-y-1">
                <span className="font-semibold text-slate-900 block">Next of Kin & Emergency Point of Contact</span>
                <p className="text-[11px]">
                  Institutional compliance mandates that each active credit facility maintain an active non-borrower
                  emergency contact on record.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Contact Full Name</label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Beatrice Sterling"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Relationship</label>
                  <input
                    type="text"
                    value={formData.emergencyContactRelationship}
                    onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="e.g. Spouse / Sibling / Business Partner"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  placeholder="+1 (555) 443-2211"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div className="flex gap-2">
              {activeTab !== 'personal' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'id_address') setActiveTab('personal');
                    else if (activeTab === 'employment') setActiveTab('id_address');
                    else if (activeTab === 'emergency') setActiveTab('employment');
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-xs"
                >
                  &larr; Previous Step
                </button>
              )}
              {activeTab !== 'emergency' && (
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === 'personal') setActiveTab('id_address');
                    else if (activeTab === 'id_address') setActiveTab('employment');
                    else if (activeTab === 'employment') setActiveTab('emergency');
                  }}
                  className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-slate-800 hover:bg-slate-200 font-medium text-xs"
                >
                  Next Step &rarr;
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
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
                    ? 'Updating...'
                    : 'Registering...'
                  : isEdit
                  ? 'Save Changes'
                  : 'Register Customer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
