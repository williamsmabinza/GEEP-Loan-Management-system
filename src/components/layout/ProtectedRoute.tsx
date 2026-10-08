import React from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { UserRole } from '../../../shared/types/index.js';
import { PermissionCode } from '../../../shared/constants/roles.js';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  requiredPermission?: PermissionCode | string;
  requiredAnyPermission?: Array<PermissionCode | string>;
  children: React.ReactNode;
  fallbackTab?: string;
  onRedirect?: (tab: string) => void;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  requiredPermission,
  requiredAnyPermission,
  children,
  onRedirect,
}) => {
  const { user, isAuthenticated, isLoading, hasPermission, hasAnyPermission, switchRoleDemo } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <div className="h-6 w-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">Verifying security credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 max-w-md mx-auto text-center my-12 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Authentication Required</h3>
        <p className="mt-2 text-sm text-slate-600">
          This system resource requires an authenticated enterprise session.
        </p>
        <div className="mt-6">
          <button
            onClick={() => onRedirect?.('login')}
            className="w-full py-2 px-4 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Super admin bypasses all UI guards
  if (user.role === 'SUPER_ADMIN') {
    return <>{children}</>;
  }

  let isAuthorized = true;
  let rejectionReason = '';

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    isAuthorized = false;
    rejectionReason = `Restricted to roles: [${allowedRoles.join(', ')}]`;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    isAuthorized = false;
    rejectionReason = `Requires granular permission: '${requiredPermission}'`;
  }

  if (requiredAnyPermission && !hasAnyPermission(requiredAnyPermission)) {
    isAuthorized = false;
    rejectionReason = `Requires at least one of permissions: [${requiredAnyPermission.join(', ')}]`;
  }

  if (!isAuthorized) {
    return (
      <div className="bg-white border border-rose-200 rounded-lg p-8 max-w-lg mx-auto my-12 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
          <span className="text-xs font-mono font-semibold text-rose-600 uppercase tracking-wider">Access Restricted (HTTP 403 Forbidden)</span>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-900">Insufficient Privileges</h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Your current authenticated session is assigned role <strong className="font-mono text-slate-900">{user.role}</strong>.
        </p>
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-700">
          {rejectionReason}
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Switch persona to test authorization:</span>
          <div className="flex gap-2">
            <button
              onClick={() => switchRoleDemo('ADMIN')}
              className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800"
            >
              Admin
            </button>
            <button
              onClick={() => switchRoleDemo('LOAN_OFFICER')}
              className="px-3 py-1.5 bg-slate-100 text-slate-800 border border-slate-300 rounded text-xs font-medium hover:bg-slate-200"
            >
              Loan Officer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

