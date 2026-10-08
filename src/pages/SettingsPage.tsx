import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';

interface SettingItem {
  key: string;
  value: string;
  description: string;
  group: string;
}

export const SettingsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.settings.getAll();
      setSettings(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load system settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleValueChange = (key: string, newValue: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value: newValue } : s))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        settings: settings.map((s) => ({ key: s.key, value: s.value })),
      };
      const updated = await api.settings.update(payload);
      setSettings(updated);
      setSuccessMsg('System configuration variables saved and audited successfully.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const canUpdate = hasPermission('settings.update');

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            System Configuration & Risk Parameters
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Global institutional limits, base interest curves, delinquency thresholds, and security parameters
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchSettings}
            className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Reset
          </button>
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

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Credit Policy & Loan Limits
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Parameters governing facility underwriting and interest accrual
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings
              .filter((s) => s.group === 'LOAN_DEFAULTS' || s.group === 'ACCOUNTING')
              .map((s) => (
                <div key={s.key} className="space-y-1">
                  <label className="block text-xs font-mono font-medium text-slate-800">
                    {s.key}
                  </label>
                  <input
                    type="text"
                    disabled={!canUpdate}
                    value={s.value}
                    onChange={(e) => handleValueChange(s.key, e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <p className="text-[11px] text-slate-500">{s.description}</p>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Institutional & Security Parameters
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Access timeouts, lockouts, and corporate metadata
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings
              .filter((s) => s.group === 'GENERAL' || s.group === 'SECURITY')
              .map((s) => (
                <div key={s.key} className="space-y-1">
                  <label className="block text-xs font-mono font-medium text-slate-800">
                    {s.key}
                  </label>
                  <input
                    type="text"
                    disabled={!canUpdate}
                    value={s.value}
                    onChange={(e) => handleValueChange(s.key, e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                  <p className="text-[11px] text-slate-500">{s.description}</p>
                </div>
              ))}
          </div>
        </div>

        {canUpdate && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 disabled:opacity-50 shadow-sm"
            >
              {isSaving ? 'Saving Configurations...' : 'Save System Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
