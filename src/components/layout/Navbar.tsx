import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { UserRole } from '../../../shared/types/index.js';
import { ChangePasswordModal } from '../common/ChangePasswordModal.js';
import { NotificationBell } from '../notifications/NotificationBell.js';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout, switchRoleDemo, hasPermission, canUnderwrite } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isSwitchingPersona, setIsSwitchingPersona] = useState(false);

  const handleRoleSelect = async (role: UserRole) => {
    setIsSwitchingPersona(true);
    try {
      await switchRoleDemo(role);
    } finally {
      setIsSwitchingPersona(false);
    }
  };

  const navItems = [
    {
      id: 'admin',
      label: 'Underwriting & Loans',
      visible: canUnderwrite || hasPermission('loan.view'),
    },
    {
      id: 'customers',
      label: 'Borrowers',
      visible: hasPermission('customer.view'),
    },
    {
      id: 'payments',
      label: 'Cashier & Payments',
      visible: hasPermission('payment.view'),
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      visible: hasPermission('report.view'),
    },
    {
      id: 'users',
      label: 'User Admin & RBAC',
      visible: hasPermission('user.view'),
    },
    {
      id: 'settings',
      label: 'Settings',
      visible: hasPermission('settings.view'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      visible: true,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      visible: hasPermission('audit.view'),
    },
    {
      id: 'customer',
      label: 'Customer Portal',
      visible: true,
    },
    {
      id: 'products',
      label: 'Loan Catalog',
      visible: true,
    },
    {
      id: 'architecture',
      label: 'Architecture & Deploy',
      visible: true,
    },
  ];

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => onSelectTab(canUnderwrite ? 'admin' : 'customer')}
                className="text-lg font-bold tracking-tight text-slate-900 hover:text-slate-700 transition-colors focus:outline-none flex items-center gap-2"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-900 inline-block" />
                <span>Nexa LMS</span>
              </button>
              <span className="hidden sm:inline text-[11px] text-slate-400 font-mono">v1.0-enterprise</span>
            </div>

            {/* Navigation Links */}
            <nav className="hidden xl:flex items-center gap-5 text-xs font-medium text-slate-600">
              {navItems
                .filter((item) => item.visible)
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    className={`py-1.5 transition-colors relative ${
                      currentTab === item.id
                        ? 'text-slate-900 border-b-2 border-slate-900 font-semibold'
                        : 'hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
            </nav>

            {/* Actions & Persona Switcher */}
            <div className="flex items-center gap-3">
              {/* Persona Switcher Dropdown */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-400 hidden lg:inline mr-1">Persona:</span>
                <select
                  disabled={isSwitchingPersona}
                  value={user?.role || 'ADMIN'}
                  onChange={(e) => handleRoleSelect(e.target.value as UserRole)}
                  className="px-2 py-1 border border-slate-300 rounded text-xs font-mono font-medium focus:ring-1 focus:ring-slate-900 focus:outline-none bg-slate-50 hover:bg-slate-100 transition-colors"
                  title="Switch between all 10 institutional personas to test strict RBAC permissions"
                >
                  <option value="SUPER_ADMIN">👑 SUPER ADMIN (Victoria)</option>
                  <option value="ADMIN">🛡️ ADMIN (Sarah)</option>
                  <option value="BRANCH_MANAGER">🏢 BRANCH MGR (David)</option>
                  <option value="LOAN_OFFICER">📋 LOAN OFFICER (Marcus)</option>
                  <option value="CREDIT_OFFICER">⚖️ CREDIT OFFICER (Elena)</option>
                  <option value="UNDERWRITER">📑 UNDERWRITER (Julian)</option>
                  <option value="CASHIER">💵 CASHIER (Chloe)</option>
                  <option value="ACCOUNTANT">📊 ACCOUNTANT (Robert)</option>
                  <option value="COLLECTION_OFFICER">🚨 COLLECTION (Damian)</option>
                  <option value="CUSTOMER">👤 CUSTOMER (Alexander)</option>
                </select>
              </div>

              {/* Notification Center Popover & Unread Counter */}
              <NotificationBell onOpenFullCenter={() => onSelectTab('notifications')} />

              {/* User Profile */}
              <div className="hidden sm:flex flex-col text-right pl-2 border-l border-slate-200">
                <span className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-[10px] text-slate-500 font-mono tracking-tight">
                  {user?.role.replace('_', ' ')}
                </span>
              </div>

              {/* Password Change Action */}
              <button
                onClick={() => setShowPasswordModal(true)}
                title="Change security password"
                className="px-2 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
              >
                Password
              </button>

              {/* Logout Action */}
              <button
                onClick={logout}
                className="px-3 py-1 text-xs font-medium text-slate-700 border border-slate-300 rounded hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Submenu for Medium/Small Screens */}
        <div className="xl:hidden flex items-center gap-4 px-4 py-2 border-t border-slate-100 overflow-x-auto text-xs font-medium text-slate-600 bg-slate-50/50">
          {navItems
            .filter((item) => item.visible)
            .map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`whitespace-nowrap py-0.5 ${
                  currentTab === item.id ? 'text-slate-900 font-bold border-b border-slate-900' : 'hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
        </div>
      </header>

      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </>
  );
};
