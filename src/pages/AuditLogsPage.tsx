import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { AuditLogDTO } from '../../shared/types/index.js';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogDTO | null>(null);

  const fetchLogs = () => {
    setIsLoading(true);
    api.audit
      .getLogs(100)
      .then(setLogs)
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Institutional Audit & Compliance Ledger
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable log of system logins, credit underwriting actions, status transitions, and payments
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition-colors"
        >
          Refresh Audit Trail
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recorded Security & Business Events</h2>
          <span className="text-xs text-slate-400 font-mono">{logs.length} events retrieved</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading compliance audit records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <tr>
                  <th className="py-3 px-6">Timestamp (UTC)</th>
                  <th className="py-3 px-6">Action</th>
                  <th className="py-3 px-6">Actor</th>
                  <th className="py-3 px-6">Resource Target</th>
                  <th className="py-3 px-6">IP Address</th>
                  <th className="py-3 px-6 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-6 text-slate-600 whitespace-nowrap">
                      {new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3 px-6">
                      <span className="font-semibold text-slate-900">{log.action}</span>
                    </td>
                    <td className="py-3 px-6 text-slate-700 font-sans">
                      {log.userFullName || log.userEmail || 'System Process'}
                    </td>
                    <td className="py-3 px-6 text-slate-600">
                      {log.resource} {log.resourceId ? `(${log.resourceId})` : ''}
                    </td>
                    <td className="py-3 px-6 text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="py-3 px-6 text-right">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2 py-0.5 border border-slate-200 rounded text-[10px] text-slate-700 hover:bg-slate-100 font-sans"
                        >
                          Inspect JSON
                        </button>
                      ) : (
                        <span className="text-slate-300 font-sans">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Audit Event Payload</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedLog.action} · ID: {selectedLog.id}
                </p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 text-lg">
                ✕
              </button>
            </div>

            <pre className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono overflow-x-auto max-h-80">
              {JSON.stringify(selectedLog.details, null, 2)}
            </pre>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
