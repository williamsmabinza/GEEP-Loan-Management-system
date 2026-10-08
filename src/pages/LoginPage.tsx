import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Login form state
  const [email, setEmail] = useState('customer@nexa.financial');
  const [password, setPassword] = useState('Customer@2026!');

  // Register form state
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regIncome, setRegIncome] = useState<number>(95000);
  const [regEmployment, setRegEmployment] = useState('FULL_TIME_SALARIED');

  // Forgot / Reset Password state
  const [resetEmail, setResetEmail] = useState('customer@nexa.financial');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'submit'>('request');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
        onSuccess();
      } else if (mode === 'register') {
        await register({
          firstName: regFirstName,
          lastName: regLastName,
          email: regEmail,
          password: regPassword,
          annualIncome: Number(regIncome),
          employmentStatus: regEmployment,
        });
        onSuccess();
      } else if (mode === 'forgot') {
        if (resetStep === 'request') {
          const res = await api.auth.forgotPassword({ email: resetEmail });
          setSuccessMsg(res.message);
          if (res.resetToken) {
            setResetToken(res.resetToken);
          }
          setResetStep('submit');
        } else {
          await api.auth.resetPassword({ token: resetToken, newPassword });
          setSuccessMsg('Password successfully reset. You can now sign in.');
          setMode('login');
          setEmail(resetEmail);
          setPassword(newPassword);
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const setDemoAccount = (persona: string) => {
    setError(null);
    setSuccessMsg(null);
    setMode('login');

    const accounts: Record<string, { email: string; pass: string }> = {
      superadmin: { email: 'superadmin@nexa.financial', pass: 'SuperAdmin@2026!' },
      admin: { email: 'admin@nexa.financial', pass: 'Admin@2026!' },
      manager: { email: 'manager@nexa.financial', pass: 'Manager@2026!' },
      officer: { email: 'officer@nexa.financial', pass: 'Officer@2026!' },
      credit: { email: 'credit@nexa.financial', pass: 'Credit@2026!' },
      cashier: { email: 'cashier@nexa.financial', pass: 'Cashier@2026!' },
      accountant: { email: 'accountant@nexa.financial', pass: 'Accountant@2026!' },
      collector: { email: 'collector@nexa.financial', pass: 'Collector@2026!' },
      customer: { email: 'customer@nexa.financial', pass: 'Customer@2026!' },
    };

    const target = accounts[persona] || accounts.admin;
    setEmail(target.email);
    setPassword(target.pass);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-3.5 h-3.5 rounded-sm bg-slate-900 inline-block" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500">
              Nexa Banking Systems
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nexa Loan Management System</h1>
          <p className="mt-1 text-xs text-slate-500 font-mono tracking-wide uppercase">
            Enterprise Lending & Servicing Infrastructure
          </p>
        </div>

        {/* Quick Demo Credentials Bar with All Institutional Personas */}
        <div className="mt-6 bg-white border border-slate-200 rounded-lg p-3.5 text-xs shadow-xs">
          <div className="font-semibold text-slate-800 mb-2 flex items-center justify-between">
            <span>Instant Role Simulation (Institutional Credentials):</span>
            <span className="text-[10px] text-slate-400 font-mono">10 Granular Personas</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
            <button
              type="button"
              onClick={() => setDemoAccount('superadmin')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'superadmin@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              👑 Super Admin
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('admin')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'admin@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              🛡️ Administrator
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('manager')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'manager@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              🏢 Branch Mgr
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('officer')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'officer@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              📋 Loan Officer
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('credit')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'credit@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              ⚖️ Credit Officer
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('cashier')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'cashier@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              💵 Cashier Desk
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('accountant')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'accountant@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              📊 Accountant
            </button>
            <button
              type="button"
              onClick={() => setDemoAccount('customer')}
              className={`py-1.5 px-2 text-left border rounded transition-colors ${
                email === 'customer@nexa.financial' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
            >
              👤 Customer Portal
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-lg sm:px-10">
          {/* Form Tabs */}
          <div className="flex border-b border-slate-200 mb-6 text-xs sm:text-sm">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                mode === 'login'
                  ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                mode === 'register'
                  ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Register Borrower Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2 text-center font-medium transition-colors ${
                mode === 'forgot'
                  ? 'border-b-2 border-slate-900 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Password Reset
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'login' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Institutional Email / Login
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="officer@nexa.financial"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-xs text-slate-500 hover:text-slate-900 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </>
            )}

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                      First Name
                    </label>
                    <input
                      type="text"
                      required
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      placeholder="Jane"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Last Name
                    </label>
                    <input
                      type="text"
                      required
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder="applicant@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                    Password (Min 8 char, 1 uppercase, 1 number)
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder="SecurePass2026!"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Annual Income ($)
                    </label>
                    <input
                      type="number"
                      min="1000"
                      value={regIncome}
                      onChange={(e) => setRegIncome(Number(e.target.value))}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Employment
                    </label>
                    <select
                      value={regEmployment}
                      onChange={(e) => setRegEmployment(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="FULL_TIME_SALARIED">Salaried Full-Time</option>
                      <option value="BUSINESS_OWNER">Business Owner</option>
                      <option value="SELF_EMPLOYED">Self Employed</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {mode === 'forgot' && (
              <>
                {resetStep === 'request' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                      Account Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      placeholder="operator@nexa.financial"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      A cryptographically signed password reset token will be generated.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                        Security Reset Token
                      </label>
                      <input
                        type="text"
                        required
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 8 chars, 1 uppercase, 1 number"
                        className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing Request...
                  </span>
                ) : mode === 'login' ? (
                  'Authorize Session'
                ) : mode === 'register' ? (
                  'Submit Registration'
                ) : resetStep === 'request' ? (
                  'Request Password Reset Token'
                ) : (
                  'Confirm Password Reset'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-4 text-center">
            <span className="text-[11px] text-slate-400">
              Session credentials issued by Nexa JWT Auth Core. All login attempts are recorded in the compliance audit trail.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
