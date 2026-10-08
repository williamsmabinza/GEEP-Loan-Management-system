import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { UserDTO, UserRole, UserStatus } from '../../shared/types/index.js';
import { SYSTEM_ROLES, ROLE_PERMISSIONS_MATRIX, PERMISSIONS } from '../../shared/constants/roles.js';
import { StatCard } from '../components/common/StatCard.js';

export const UserManagementPage: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter state
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'LOAN_OFFICER' as UserRole,
    firstName: '',
    lastName: '',
    phone: '',
    department: 'Commercial Credit Origination',
    designation: 'Loan Officer',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status Change Modal State
  const [targetUser, setTargetUser] = useState<UserDTO | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [newStatus, setNewStatus] = useState<UserStatus>('SUSPENDED');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Inspect & Configure Permissions Tab
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<UserRole>('ADMIN');
  const [matrixConfig, setMatrixConfig] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem('nexa_role_permissions_matrix');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return { ...ROLE_PERMISSIONS_MATRIX };
  });

  const canConfigureWorkflow =
    hasPermission('workflow.config') ||
    currentUser?.role === 'ADMIN' ||
    currentUser?.role === 'SUPER_ADMIN';

  const handleTogglePermission = (permCode: string) => {
    if (!canConfigureWorkflow || selectedRoleForMatrix === 'SUPER_ADMIN') return;
    const currentList = matrixConfig[selectedRoleForMatrix] || [];
    const exists = currentList.includes(permCode);
    const updated = exists ? currentList.filter((p) => p !== permCode) : [...currentList, permCode];
    setMatrixConfig((prev) => ({
      ...prev,
      [selectedRoleForMatrix]: updated,
    }));
  };

  const handleSaveMatrix = () => {
    localStorage.setItem('nexa_role_permissions_matrix', JSON.stringify(matrixConfig));
    setSuccessMsg(`Workflow permissions configuration for ${selectedRoleForMatrix} saved successfully.`);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.users.getAll();
      setUsers(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch user directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.users.create(formData);
      setSuccessMsg(`User ${formData.email} registered successfully.`);
      setShowCreateModal(false);
      setFormData({
        email: '',
        password: '',
        role: 'LOAN_OFFICER',
        firstName: '',
        lastName: '',
        phone: '',
        department: 'Commercial Credit Origination',
        designation: 'Loan Officer',
      });
      await fetchUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setIsUpdatingStatus(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.users.updateStatus(targetUser.id, {
        status: newStatus as any,
        reason: statusReason || `Administrative status change to ${newStatus}`,
      });
      setSuccessMsg(`Account ${targetUser.email} status changed to ${newStatus}.`);
      setTargetUser(null);
      setStatusReason('');
      await fetchUsers();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchName = `${u.firstName} ${u.lastName}`.toLowerCase().includes(query);
      const matchEmail = u.email.toLowerCase().includes(query);
      const matchRole = u.role.toLowerCase().includes(query);
      return matchName || matchEmail || matchRole;
    }
    return true;
  });

  const canCreateUser = hasPermission('user.create');
  const canDisableUser = hasPermission('user.disable');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            User Administration & Access Control (RBAC)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise identity management, granular security roles, and account lifecycle activation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Refresh Directory
          </button>
          {canCreateUser && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              + Provision Staff / User
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded">
          {successMsg}
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Registered Accounts"
          value={users.length.toString()}
          subtext="Institutional & borrower entities"
        />
        <StatCard
          label="Active Staff Operators"
          value={users.filter((u) => u.role !== 'CUSTOMER' && u.status === 'ACTIVE').length.toString()}
          subtext="Underwriters, cashiers & officers"
        />
        <StatCard
          label="Active Borrowers"
          value={users.filter((u) => u.role === 'CUSTOMER' && u.status === 'ACTIVE').length.toString()}
          subtext="Retail & commercial portal accounts"
        />
        <StatCard
          label="Locked or Suspended"
          value={users.filter((u) => u.status === 'SUSPENDED' || u.status === 'LOCKED').length.toString()}
          subtext="Access blocked by policy"
        />
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none w-full sm:w-64"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
          >
            <option value="ALL">All Roles</option>
            {Object.keys(SYSTEM_ROLES).map((roleKey) => (
              <option key={roleKey} value={roleKey}>
                {roleKey.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white"
          >
            <option value="ALL">All Account Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="LOCKED">Locked</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredUsers.length} of {users.length} accounts
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
            Directory Roster & Security Credentials
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">Enforcing backend RBAC guards</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-500 font-medium">
                <th className="py-2.5 px-4">Operator / Borrower</th>
                <th className="py-2.5 px-4">Role Code</th>
                <th className="py-2.5 px-4">Department / Designation</th>
                <th className="py-2.5 px-4">Contact Phone</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Assigned Permissions</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading security directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No users match current filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const rolePerms = ROLE_PERMISSIONS_MATRIX[u.role] || [];
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {u.firstName} {u.lastName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {u.staffProfile ? (
                          <div>
                            <div className="font-medium text-slate-800">{u.staffProfile.designation}</div>
                            <div className="text-[11px] text-slate-400">{u.staffProfile.department}</div>
                          </div>
                        ) : u.customer ? (
                          <div>
                            <div className="font-medium text-slate-800">{u.customer.employmentType.replace('_', ' ')}</div>
                            <div className="text-[11px] text-slate-400">{u.customer.employerName || 'Retail Customer'}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-mono">System Account</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                        {u.phoneNumber || u.staffProfile?.phone || u.customer?.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : u.status === 'SUSPENDED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-[11px] text-slate-500 font-mono">
                          {u.role === 'SUPER_ADMIN' ? (
                            <span className="text-indigo-600 font-medium">All Permissions (Bypass)</span>
                          ) : (
                            <span>{rolePerms.length} privileges granted</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canDisableUser && u.id !== currentUser?.id && u.role !== 'SUPER_ADMIN' ? (
                          <div className="flex items-center justify-end gap-2">
                            {u.status === 'ACTIVE' ? (
                              <button
                                onClick={() => {
                                  setTargetUser(u);
                                  setNewStatus('SUSPENDED');
                                }}
                                className="px-2 py-1 text-[11px] border border-rose-200 text-rose-700 rounded hover:bg-rose-50 transition-colors"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setTargetUser(u);
                                  setNewStatus('ACTIVE');
                                }}
                                className="px-2 py-1 text-[11px] border border-emerald-200 text-emerald-700 rounded hover:bg-emerald-50 transition-colors"
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Matrix Reference Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Role-Based Access Control (RBAC) & Workflow Permissions Configuration
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Administrators can configure granular permissions across all operational roles
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Configure Role:</span>
              <select
                value={selectedRoleForMatrix}
                onChange={(e) => setSelectedRoleForMatrix(e.target.value as UserRole)}
                className="px-3 py-1 border border-slate-300 rounded text-xs font-mono font-medium focus:outline-none bg-white"
              >
                {Object.keys(SYSTEM_ROLES).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {canConfigureWorkflow && selectedRoleForMatrix !== 'SUPER_ADMIN' && (
              <button
                type="button"
                onClick={handleSaveMatrix}
                className="px-3 py-1 bg-indigo-900 hover:bg-indigo-800 text-white rounded text-xs font-semibold shadow-xs"
              >
                Save Permissions
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-2">
            <span>
              Configured permissions for <strong className="text-slate-900">{selectedRoleForMatrix}</strong>:
            </span>
            {canConfigureWorkflow && selectedRoleForMatrix !== 'SUPER_ADMIN' && (
              <span className="text-[11px] text-indigo-700 font-sans font-medium">
                Click any permission below to grant or revoke
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Object.values(PERMISSIONS).map((permCode) => {
              const roleList = matrixConfig[selectedRoleForMatrix] || [];
              const isGranted =
                selectedRoleForMatrix === 'SUPER_ADMIN' ||
                roleList.includes(permCode);

              const canToggle = canConfigureWorkflow && selectedRoleForMatrix !== 'SUPER_ADMIN';

              return (
                <div
                  key={permCode}
                  onClick={() => canToggle && handleTogglePermission(permCode)}
                  className={`p-2 rounded border text-xs font-mono flex items-center justify-between transition-colors ${
                    canToggle ? 'cursor-pointer hover:border-indigo-400' : ''
                  } ${
                    isGranted
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                  }`}
                >
                  <span className="truncate">{permCode}</span>
                  <span className={`text-[10px] font-bold ${isGranted ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {isGranted ? '✓' : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Provision User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Provision Enterprise Account</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Email Address (Login)</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="operator@nexa.financial"
                  className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">Initial Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Security Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white font-mono"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="BRANCH_MANAGER">BRANCH_MANAGER</option>
                    <option value="LOAN_OFFICER">LOAN_OFFICER</option>
                    <option value="CREDIT_OFFICER">CREDIT_OFFICER</option>
                    <option value="UNDERWRITER">UNDERWRITER</option>
                    <option value="CASHIER">CASHIER</option>
                    <option value="ACCOUNTANT">ACCOUNTANT</option>
                    <option value="COLLECTION_OFFICER">COLLECTION_OFFICER</option>
                    <option value="CUSTOMER">CUSTOMER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Phone</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {formData.role !== 'CUSTOMER' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Department</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Designation</label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {targetUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Change Account Status</h3>
              <button
                onClick={() => setTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <p className="text-xs text-slate-600">
                  Target Account: <strong className="text-slate-900">{targetUser.email}</strong> ({targetUser.role})
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                  className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none bg-white font-mono"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="LOCKED">LOCKED</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Audit Reason (Recorded in compliance log)
                </label>
                <textarea
                  required
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Provide detailed compliance reason for account status transition..."
                  className="mt-1 w-full px-3 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTargetUser(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {isUpdatingStatus ? 'Updating...' : 'Confirm Status Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
