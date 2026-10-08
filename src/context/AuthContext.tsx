import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserDTO, UserRole } from '../../shared/types/index.js';
import { LoginInput, RegisterInput, ChangePasswordInput } from '../../shared/validators/auth.js';
import { roleHasPermission, PermissionCode } from '../../shared/constants/roles.js';
import { api } from '../services/api.js';

interface AuthContextType {
  user: UserDTO | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  register: (payload: RegisterInput) => Promise<void>;
  logout: () => void;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  switchRoleDemo: (role: UserRole) => Promise<void>;
  hasPermission: (permission: PermissionCode | string) => boolean;
  hasAnyPermission: (permissions: Array<PermissionCode | string>) => boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isBranchManager: boolean;
  isLoanOfficer: boolean;
  isCreditOfficer: boolean;
  isUnderwriter: boolean;
  isCashier: boolean;
  isAccountant: boolean;
  isCollectionOfficer: boolean;
  isCustomer: boolean;
  canUnderwrite: boolean;
  canApprove: boolean;
  canDisburse: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on mount
  useEffect(() => {
    async function loadCurrentUser() {
      if (!api.getToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const userData = await api.auth.getMe();
        setUser(userData);
      } catch (err) {
        console.warn('Session expired or invalid, logging out:', err);
        api.auth.logout();
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadCurrentUser();
  }, []);

  const login = async (credentials: LoginInput) => {
    setIsLoading(true);
    try {
      const data = await api.auth.login(credentials);
      setUser(data.user);
      setToken(data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterInput) => {
    setIsLoading(true);
    try {
      const data = await api.auth.register(payload);
      setUser(data.user);
      setToken(data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.auth.logout();
    setUser(null);
    setToken(null);
  };

  const changePassword = async (input: ChangePasswordInput) => {
    await api.auth.changePassword(input);
  };

  const switchRoleDemo = async (role: UserRole) => {
    const roleCredentials: Record<UserRole, { email: string; pass: string }> = {
      SUPER_ADMIN: { email: 'superadmin@nexa.financial', pass: 'SuperAdmin@2026!' },
      ADMIN: { email: 'admin@nexa.financial', pass: 'Admin@2026!' },
      BRANCH_MANAGER: { email: 'manager@nexa.financial', pass: 'Manager@2026!' },
      LOAN_OFFICER: { email: 'officer@nexa.financial', pass: 'Officer@2026!' },
      CREDIT_OFFICER: { email: 'credit@nexa.financial', pass: 'Credit@2026!' },
      UNDERWRITER: { email: 'underwriter@nexa.financial', pass: 'Underwriter@2026!' },
      CASHIER: { email: 'cashier@nexa.financial', pass: 'Cashier@2026!' },
      ACCOUNTANT: { email: 'accountant@nexa.financial', pass: 'Accountant@2026!' },
      COLLECTION_OFFICER: { email: 'collector@nexa.financial', pass: 'Collector@2026!' },
      CUSTOMER: { email: 'customer@nexa.financial', pass: 'Customer@2026!' },
    };

    const target = roleCredentials[role] || roleCredentials.ADMIN;
    await login({ email: target.email, password: target.pass });
  };

  const hasPermission = (permission: PermissionCode | string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    if (user.permissions && user.permissions.includes(permission)) return true;
    return roleHasPermission(user.role, permission);
  };

  const hasAnyPermission = (permissions: Array<PermissionCode | string>): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return permissions.some((p) => hasPermission(p));
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN' || isSuperAdmin;
  const isBranchManager = user?.role === 'BRANCH_MANAGER';
  const isLoanOfficer = user?.role === 'LOAN_OFFICER';
  const isCreditOfficer = user?.role === 'CREDIT_OFFICER';
  const isUnderwriter = user?.role === 'UNDERWRITER';
  const isCashier = user?.role === 'CASHIER';
  const isAccountant = user?.role === 'ACCOUNTANT';
  const isCollectionOfficer = user?.role === 'COLLECTION_OFFICER';
  const isCustomer = user?.role === 'CUSTOMER';

  const canUnderwrite = hasAnyPermission(['loan.view', 'loan.approve', 'loan.update']) && !isCustomer;
  const canApprove = hasPermission('loan.approve');
  const canDisburse = hasPermission('loan.disburse');

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        changePassword,
        switchRoleDemo,
        hasPermission,
        hasAnyPermission,
        isSuperAdmin,
        isAdmin,
        isBranchManager,
        isLoanOfficer,
        isCreditOfficer,
        isUnderwriter,
        isCashier,
        isAccountant,
        isCollectionOfficer,
        isCustomer,
        canUnderwrite,
        canApprove,
        canDisburse,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

