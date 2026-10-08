import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { LoginPage } from './pages/LoginPage.js';
import { CustomerDashboard } from './pages/CustomerDashboard.js';
import { AdminDashboard } from './pages/AdminDashboard.js';
import { CustomersPage } from './pages/CustomersPage.js';
import { PaymentsPage } from './pages/PaymentsPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { UserManagementPage } from './pages/UserManagementPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LoanProductsPage } from './pages/LoanProductsPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { NotificationsPage } from './pages/NotificationsPage.js';
import { SystemArchitecturePage } from './pages/SystemArchitecturePage.js';

function MainRouter() {
  const { isAuthenticated, user, canUnderwrite } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('customer');

  // Sync default tab when user identity or role changes
  useEffect(() => {
    if (isAuthenticated && user) {
      if (canUnderwrite) {
        setCurrentTab('admin');
      } else {
        setCurrentTab('customer');
      }
    }
  }, [isAuthenticated, user?.role, canUnderwrite]);

  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => setCurrentTab(canUnderwrite ? 'admin' : 'customer')} />;
  }

  return (
    <AppLayout currentTab={currentTab} onSelectTab={setCurrentTab}>
      {currentTab === 'customer' && (
        <ProtectedRoute onRedirect={setCurrentTab}>
          <CustomerDashboard />
        </ProtectedRoute>
      )}

      {currentTab === 'admin' && (
        <ProtectedRoute
          requiredAnyPermission={['loan.view', 'loan.approve', 'loan.update', 'loan.disburse']}
          onRedirect={setCurrentTab}
        >
          <AdminDashboard />
        </ProtectedRoute>
      )}

      {currentTab === 'customers' && (
        <ProtectedRoute requiredPermission="customer.view" onRedirect={setCurrentTab}>
          <CustomersPage />
        </ProtectedRoute>
      )}

      {currentTab === 'payments' && (
        <ProtectedRoute requiredPermission="payment.view" onRedirect={setCurrentTab}>
          <PaymentsPage />
        </ProtectedRoute>
      )}

      {currentTab === 'reports' && (
        <ProtectedRoute requiredPermission="report.view" onRedirect={setCurrentTab}>
          <ReportsPage />
        </ProtectedRoute>
      )}

      {currentTab === 'users' && (
        <ProtectedRoute requiredPermission="user.view" onRedirect={setCurrentTab}>
          <UserManagementPage />
        </ProtectedRoute>
      )}

      {currentTab === 'settings' && (
        <ProtectedRoute requiredPermission="settings.view" onRedirect={setCurrentTab}>
          <SettingsPage />
        </ProtectedRoute>
      )}

      {currentTab === 'notifications' && (
        <ProtectedRoute onRedirect={setCurrentTab}>
          <NotificationsPage />
        </ProtectedRoute>
      )}

      {currentTab === 'products' && <LoanProductsPage />}

      {currentTab === 'audit' && (
        <ProtectedRoute requiredPermission="audit.view" onRedirect={setCurrentTab}>
          <AuditLogsPage />
        </ProtectedRoute>
      )}

      {currentTab === 'architecture' && <SystemArchitecturePage />}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}
