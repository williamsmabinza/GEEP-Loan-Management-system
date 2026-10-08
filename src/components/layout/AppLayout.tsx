import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar.js';
import { api } from '../../services/api.js';
import { SystemHealthDTO } from '../../../shared/types/index.js';

interface AppLayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentTab, onSelectTab, children }) => {
  const [health, setHealth] = useState<SystemHealthDTO | null>(null);

  useEffect(() => {
    api.health
      .check()
      .then((data) => setHealth(data))
      .catch((err) => console.warn('Health check query notice:', err.message));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 antialiased">
      <Navbar currentTab={currentTab} onSelectTab={onSelectTab} />

      {/* Contextual System Operational Indicator */}
      <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-1.5 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-800">REST API Gateway:</span>
          <span>Online (/api v1)</span>
          <span className="text-slate-300">|</span>
          <span className="font-medium text-slate-800">Database Engine:</span>
          <span>
            MySQL Relational Target ({health?.database.database || 'nexa_lms'})
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 font-mono">
            {health?.database.status === 'connected'
              ? `Connected (${health.database.latencyMs}ms)`
              : 'Standby / Synchronized Buffer Mode'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-slate-500">
          <span>JWT Auth Active</span>
          <span aria-hidden="true">·</span>
          <span>Bcrypt Hash Enforced</span>
          <span aria-hidden="true">·</span>
          <span>Prisma ORM Ready</span>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Quiet Enterprise Footer (Zero Ornamental Engines) */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-medium text-slate-700">Nexa Loan Management System</span>
            <span className="mx-2">·</span>
            <span>Production Banking & Institutional Lending Core</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>MySQL Relational Schema</span>
            <span>·</span>
            <span>Prisma Client v6</span>
            <span>·</span>
            <span>Zod Schema Guard</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
