import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import {
  NotificationDTO,
  NotificationSystemSettingsDTO,
  NotificationEventType,
  NotificationChannelType,
  NotificationTypeRuleDTO,
  NotificationTemplateDTO,
  SmsProviderConfigDTO,
  EmailProviderConfigDTO,
} from '../../shared/types/index.js';

export const NotificationsPage: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isAdminOrManager = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(user?.role || '');
  const canManageSettings = hasPermission('settings.view') || hasPermission('settings.update') || isAdminOrManager;

  // Tabs: 'inbox' | 'rules' | 'templates' | 'gateways'
  const [activeTab, setActiveTab] = useState<'inbox' | 'rules' | 'templates' | 'gateways'>('inbox');

  // Inbox State
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [channelFilter, setChannelFilter] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Settings State (Rules, Templates, Providers)
  const [settings, setSettings] = useState<NotificationSystemSettingsDTO | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Template Editing State
  const [selectedTemplateEvent, setSelectedTemplateEvent] = useState<NotificationEventType>('LOAN_APPLICATION_SUBMITTED');
  const [selectedTemplateChannel, setSelectedTemplateChannel] = useState<NotificationChannelType>('IN_APP');
  const [editingTemplate, setEditingTemplate] = useState<{ id: string; subject: string; body: string; enabled: boolean } | null>(null);

  // Gateway Provider State
  const [smsConfig, setSmsConfig] = useState<Partial<SmsProviderConfigDTO>>({});
  const [emailConfig, setEmailConfig] = useState<Partial<EmailProviderConfigDTO>>({});

  // Test Dispatch Tool State
  const [testEvent, setTestEvent] = useState<NotificationEventType>('LOAN_APPLICATION_SUBMITTED');
  const [testChannel, setTestChannel] = useState<NotificationChannelType>('SMS');
  const [testRecipientPhone, setTestRecipientPhone] = useState<string>('+255712345678');
  const [testRecipientEmail, setTestRecipientEmail] = useState<string>('borrower@nexa.financial');
  const [isTestDispatching, setIsTestDispatching] = useState<boolean>(false);
  const [testDispatchResult, setTestDispatchResult] = useState<any>(null);
  const [isScanningAlerts, setIsScanningAlerts] = useState<boolean>(false);

  // Scan Repayment & Overdue Alerts
  const handleScanAlerts = async () => {
    setIsScanningAlerts(true);
    try {
      const res = await api.notifications.scanAlerts();
      fetchNotifications();
      setActionSuccess(
        `Scanned portfolio: ${res.upcomingCount} upcoming repayment reminders and ${res.overdueCount} overdue notices dispatched.`
      );
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsScanningAlerts(false);
    }
  };

  // Load Notifications Feed
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const data = await api.notifications.getAll({
        channel: channelFilter !== 'ALL' ? (channelFilter as NotificationChannelType) : undefined,
        unreadOnly,
        search: searchQuery || undefined,
        page,
        pageSize,
      });
      setNotifications(data.notifications);
      setTotalRecords(data.total);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setActionError((err as Error).message || 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [channelFilter, unreadOnly, searchQuery, page, pageSize]);

  // Load Settings (Rules, Templates, Gateways)
  const fetchSettings = useCallback(async () => {
    if (!canManageSettings) return;
    try {
      const data = await api.notifications.getSettings();
      setSettings(data);
      setSmsConfig(data.smsProvider);
      setEmailConfig(data.emailProvider);
    } catch (err) {
      console.warn('Failed to load notification settings:', err);
    }
  }, [canManageSettings]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Sync active template when selector changes
  useEffect(() => {
    if (!settings) return;
    const tmpl = settings.templates.find(
      (t) => t.eventType === selectedTemplateEvent && t.channel === selectedTemplateChannel
    );
    if (tmpl) {
      setEditingTemplate({
        id: tmpl.id,
        subject: tmpl.subjectTemplate,
        body: tmpl.bodyTemplate,
        enabled: tmpl.enabled,
      });
    } else {
      setEditingTemplate(null);
    }
  }, [settings, selectedTemplateEvent, selectedTemplateChannel]);

  // Notifications Feed Mutations
  const handleMarkAsRead = async (id: string) => {
    try {
      await api.notifications.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString(), status: 'READ' } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await api.notifications.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString(), status: 'READ' }))
      );
      setUnreadCount(0);
      setActionSuccess(`${res.count} notifications marked as read.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await api.notifications.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setTotalRecords((t) => Math.max(0, t - 1));
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  // Rule Toggle Mutations
  const handleToggleRule = async (eventType: NotificationEventType, enabled: boolean) => {
    setIsSavingSettings(true);
    try {
      const updated = await api.notifications.updateRule(eventType, { enabled });
      setSettings((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rules: prev.rules.map((r) => (r.eventType === eventType ? updated : r)),
        };
      });
      setActionSuccess(`Notification rule for ${eventType} ${enabled ? 'enabled' : 'disabled'}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleRuleChannel = async (
    eventType: NotificationEventType,
    channel: 'inApp' | 'email' | 'sms',
    active: boolean
  ) => {
    if (!settings) return;
    const rule = settings.rules.find((r) => r.eventType === eventType);
    if (!rule) return;

    const newChannels = { ...rule.channels, [channel]: active };
    setIsSavingSettings(true);
    try {
      const updated = await api.notifications.updateRule(eventType, { channels: newChannels });
      setSettings((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rules: prev.rules.map((r) => (r.eventType === eventType ? updated : r)),
        };
      });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Save Template Mutation
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    setIsSavingSettings(true);
    try {
      const updated = await api.notifications.updateTemplate(editingTemplate.id, {
        subjectTemplate: editingTemplate.subject,
        bodyTemplate: editingTemplate.body,
        enabled: editingTemplate.enabled,
      });
      setSettings((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          templates: prev.templates.map((t) => (t.id === updated.id ? updated : t)),
        };
      });
      setActionSuccess('Notification template saved successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Save Provider Gateway Configuration
  const handleSaveSmsGateway = async () => {
    setIsSavingSettings(true);
    try {
      const updated = await api.notifications.updateSmsConfig(smsConfig);
      setSmsConfig(updated);
      setSettings((prev) => (prev ? { ...prev, smsProvider: updated } : prev));
      setActionSuccess('SMS Gateway provider configuration updated successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveEmailGateway = async () => {
    setIsSavingSettings(true);
    try {
      const updated = await api.notifications.updateEmailConfig(emailConfig);
      setEmailConfig(updated);
      setSettings((prev) => (prev ? { ...prev, emailProvider: updated } : prev));
      setActionSuccess('Email Gateway configuration updated successfully.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleToggleGlobalChannel = async (channel: 'inApp' | 'email' | 'sms', active: boolean) => {
    if (!settings) return;
    const newGlobal = { ...settings.channelsGlobalEnabled, [channel]: active };
    try {
      const updated = await api.notifications.updateGlobalChannels(newGlobal);
      setSettings((prev) => (prev ? { ...prev, channelsGlobalEnabled: updated } : prev));
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  // Execute Test Dispatch
  const handleRunTestDispatch = async () => {
    setIsTestDispatching(true);
    setTestDispatchResult(null);
    try {
      const response = await api.notifications.testDispatch({
        eventType: testEvent,
        channel: testChannel,
        recipient: {
          phone: testRecipientPhone,
          email: testRecipientEmail,
        },
      });
      setTestDispatchResult(response.result);
      fetchNotifications();
      setActionSuccess(`Test notification triggered via ${testChannel}. Check the Inbox audit feed!`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setActionError((err as Error).message || 'Test dispatch failed');
    } finally {
      setIsTestDispatching(false);
    }
  };

  const getChannelBadge = (ch: NotificationChannelType) => {
    switch (ch) {
      case 'SMS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">📱 SMS</span>;
      case 'EMAIL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">✉️ Email</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">🔔 In-App</span>;
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'DELIVERED':
      case 'READ':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">Delivered</span>;
      case 'SENT':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-50 text-blue-700">Sent</span>;
      case 'FAILED':
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-rose-50 text-rose-700">Failed</span>;
      default:
        return <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700">{st}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header Banner */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-slate-900 text-white rounded text-sm">🔔</span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
              Internal Notification Center & Gateway Architecture
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl font-sans">
            Multi-channel institutional messaging (In-App, Email, SMS Gateway) with automated event triggers, custom templates, and Tanzania carrier adapters.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageSettings && (
            <button
              onClick={handleScanAlerts}
              disabled={isScanningAlerts}
              title="Automated portfolio scan: Dispatches upcoming repayment reminders (within 3 days) and arrears/overdue alerts"
              className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>⚡</span>
              <span>{isScanningAlerts ? 'Scanning...' : 'Scan Repayments & Overdues'}</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={() => handleMarkAllAsRead()}
              className="px-3 py-1.5 border border-slate-300 text-slate-700 bg-white rounded text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm"
            >
              Mark All Read ({unreadCount})
            </button>
          )}
          <button
            onClick={() => {
              fetchNotifications();
              fetchSettings();
            }}
            className="px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
          >
            Refresh Feed
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 font-bold ml-4">✕</button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-700 font-bold ml-4">✕</button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. Navigation Tabs */}
      {/* ------------------------------------------------------------------ */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'inbox'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📥 Message Feed & Audit Log</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        {canManageSettings && (
          <>
            <button
              onClick={() => setActiveTab('rules')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'rules'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>⚙️ Notification Event Rules (11 Types)</span>
            </button>

            <button
              onClick={() => setActiveTab('templates')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'templates'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📝 Message Templates</span>
            </button>

            <button
              onClick={() => setActiveTab('gateways')}
              className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'gateways'
                  ? 'border-slate-900 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🔌 Gateways & Carrier Setup (SMS / Email)</span>
            </button>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: NOTIFICATIONS INBOX & AUDIT FEED */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-medium">Channel:</span>
              {['ALL', 'IN_APP', 'SMS', 'EMAIL'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => {
                    setChannelFilter(ch);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                    channelFilter === ch
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {ch === 'ALL' ? 'All Channels' : ch}
                </button>
              ))}

              <label className="flex items-center gap-1.5 ml-3 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => {
                    setUnreadOnly(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Unread only</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search subjects, text..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1 border border-slate-300 rounded text-xs w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <span className="text-slate-400 font-mono text-[11px] whitespace-nowrap">
                {totalRecords} records
              </span>
            </div>
          </div>

          {/* Notifications List */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm divide-y divide-slate-100 overflow-hidden">
            {isLoading ? (
              <div className="p-16 text-center text-slate-400 text-xs font-sans">
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading notification messages...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-16 text-center text-slate-400 font-sans">
                <p className="text-2xl mb-1">📭</p>
                <p className="font-semibold text-slate-700 text-xs">No notifications found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  No records matched the selected channel and filter options.
                </p>
              </div>
            ) : (
              notifications.map((notif) => {
                const isUnread = !notif.readAt;
                return (
                  <div
                    key={notif.id}
                    className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
                      isUnread ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getChannelBadge(notif.channel)}
                        <span className="font-semibold text-xs text-slate-900">
                          {notif.subject}
                        </span>
                        {getStatusBadge(notif.status)}
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" title="Unread" />
                        )}
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-sans pr-4">
                        {notif.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono">
                        <span>Event: {notif.eventType.replace(/_/g, ' ')}</span>
                        {notif.customerName && <span>Borrower: {notif.customerName}</span>}
                        {notif.metadata?.provider && <span>Gateway: {notif.metadata.provider}</span>}
                        {notif.metadata?.segments && <span>Segments: {notif.metadata.segments}</span>}
                        {notif.metadata?.simulated && (
                          <span className="text-amber-600 font-medium bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            Simulated Gateway
                          </span>
                        )}
                        <span>{new Date(notif.sentAt || notif.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {isUnread && (
                        <button
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="px-2 py-1 text-[11px] font-medium text-slate-700 border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteNotification(notif.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Dismiss notification"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: NOTIFICATION EVENT RULES (11 TYPES) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'rules' && canManageSettings && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Event Trigger Automation & Channel Routing
            </h2>
            <p className="text-xs text-slate-500">
              Administrators can selectively enable or disable automated messaging across all 11 lifecycle events. Toggle delivery channels independently.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="px-4 py-3 font-semibold uppercase text-[11px]">Event Type & Purpose</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[11px] text-center">Global Event</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[11px] text-center">In-App</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[11px] text-center">Email</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[11px] text-center">SMS Gateway</th>
                  <th className="px-4 py-3 font-semibold uppercase text-[11px]">Target Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settings?.rules.map((rule) => (
                  <tr key={rule.eventType} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="font-semibold text-slate-900 text-xs">{rule.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{rule.description}</div>
                      <span className="font-mono text-[10px] text-slate-400">{rule.eventType}</span>
                    </td>

                    {/* Global Event Active Toggle */}
                    <td className="px-4 py-3.5 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={isSavingSettings}
                          onChange={(e) => handleToggleRule(rule.eventType, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900" />
                      </label>
                    </td>

                    {/* In-App Toggle */}
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={rule.channels.inApp}
                        disabled={!rule.enabled || isSavingSettings}
                        onChange={(e) => handleToggleRuleChannel(rule.eventType, 'inApp', e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-40"
                      />
                    </td>

                    {/* Email Toggle */}
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={rule.channels.email}
                        disabled={!rule.enabled || isSavingSettings}
                        onChange={(e) => handleToggleRuleChannel(rule.eventType, 'email', e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-40"
                      />
                    </td>

                    {/* SMS Toggle */}
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={rule.channels.sms}
                        disabled={!rule.enabled || isSavingSettings}
                        onChange={(e) => handleToggleRuleChannel(rule.eventType, 'sms', e.target.checked)}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-40"
                      />
                    </td>

                    {/* Target Roles */}
                    <td className="px-4 py-3.5 text-[11px] font-mono text-slate-600">
                      <div className="flex flex-wrap gap-1">
                        {rule.rolesNotified.map((role) => (
                          <span key={role} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: MESSAGE TEMPLATES */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'templates' && canManageSettings && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Template Selector */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Select Event Template
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Lifecycle Event
                </label>
                <select
                  value={selectedTemplateEvent}
                  onChange={(e) => setSelectedTemplateEvent(e.target.value as NotificationEventType)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {settings?.rules.map((r) => (
                    <option key={r.eventType} value={r.eventType}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Delivery Channel
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['IN_APP', 'EMAIL', 'SMS'] as NotificationChannelType[]).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setSelectedTemplateChannel(ch)}
                      className={`py-1.5 px-2 rounded border text-xs font-medium text-center transition-colors ${
                        selectedTemplateChannel === ch
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {ch === 'IN_APP' ? 'In-App' : ch === 'EMAIL' ? 'Email' : 'SMS'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Available Template Variables
              </h3>
              <p className="text-[11px] text-slate-500 mb-2">
                Interpolate dynamic values using double curly braces:
              </p>
              <div className="flex flex-wrap gap-1">
                {[
                  'customerName',
                  'customerFirstName',
                  'applicationNumber',
                  'loanNumber',
                  'amount',
                  'approvedAmount',
                  'dueDate',
                  'firstDueDate',
                  'monthlyInstallment',
                  'receiptNumber',
                  'remainingBalance',
                  'rejectionReason',
                  'overdueAmount',
                  'daysOverdue',
                  'disbursementMethod',
                  'transactionReference',
                ].map((varName) => (
                  <span
                    key={varName}
                    className="font-mono text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200"
                  >
                    {`{{${varName}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Template Editor */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  Editing Template: {selectedTemplateEvent.replace(/_/g, ' ')} ({selectedTemplateChannel})
                </h3>
                <p className="text-xs text-slate-500">
                  Configure text and variable placeholders used during automated notification dispatch
                </p>
              </div>

              {editingTemplate && (
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={editingTemplate.enabled}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, enabled: e.target.checked })
                    }
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="font-medium text-slate-700">Template Enabled</span>
                </label>
              )}
            </div>

            {editingTemplate ? (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Subject Line / Header
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.subject}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, subject: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded font-sans text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="Enter subject template with {{variables}}..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      Message Body ({selectedTemplateChannel === 'SMS' ? 'SMS Text (Concise segments)' : 'Rich Content'})
                    </label>
                    {selectedTemplateChannel === 'SMS' && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {editingTemplate.body.length} chars (Approx {Math.ceil(editingTemplate.body.length / 160) || 1} SMS segments)
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={8}
                    value={editingTemplate.body}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, body: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 leading-relaxed"
                    placeholder="Enter template body content with dynamic variables..."
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={isSavingSettings}
                    className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isSavingSettings ? 'Saving...' : 'Save Template Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                No template found for the selected combination.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: GATEWAYS & CARRIER SETUP (SMS & EMAIL) */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'gateways' && canManageSettings && (
        <div className="space-y-6">
          {/* Global Channel Availability */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Global Notification Channels Master Switch
            </h2>
            <p className="text-xs text-slate-500">
              Emergency master toggles to halt or resume institutional transmissions across entire channels.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {[
                { key: 'inApp', label: 'In-App Notifications', desc: 'Real-time bells & popovers' },
                { key: 'email', label: 'Email Transmissions', desc: 'SMTP & Transactional Mail' },
                { key: 'sms', label: 'SMS Carrier Gateway', desc: 'Direct mobile handsets' },
              ].map((ch) => {
                const isActive = settings?.channelsGlobalEnabled[ch.key as keyof typeof settings.channelsGlobalEnabled];
                return (
                  <div key={ch.key} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-slate-900">{ch.label}</span>
                      <p className="text-[11px] text-slate-500">{ch.desc}</p>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!isActive}
                        onChange={(e) =>
                          handleToggleGlobalChannel(ch.key as any, e.target.checked)
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900" />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SMS Carrier Gateway Setup (Extensible Architecture) */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">📱</span>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">
                    SMS Carrier Gateway Adapter (Tanzania & Regional Providers)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plug-and-play architecture supporting NextSMS Tanzania, Beem Africa, Twilio, or generic webhook relays.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Safe Mode / Sandbox:</span>
                <input
                  type="checkbox"
                  checked={!!smsConfig.sandboxMode}
                  onChange={(e) => setSmsConfig({ ...smsConfig, sandboxMode: e.target.checked })}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
              </div>
            </div>

            {smsConfig.sandboxMode && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg">
                <strong>🛡️ Sandbox Safe Mode is ACTIVE:</strong> Outgoing SMS will be simulated and recorded in the audit log without making live telecommunication charges or external network requests.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Selected Provider Adapter
                </label>
                <select
                  value={smsConfig.providerId || 'SANDBOX'}
                  onChange={(e) => setSmsConfig({ ...smsConfig, providerId: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="SANDBOX">Simulated Sandbox Mode (Zero Cost / Safe)</option>
                  <option value="NEXT_SMS">NextSMS (Tanzania Domestic Gateway)</option>
                  <option value="BEEM_SMS">Beem Africa (Tanzania & East Africa Gateway)</option>
                  <option value="TWILIO">Twilio SMS (Global Telecom)</option>
                  <option value="GENERIC_WEBHOOK">Custom HTTP Webhook Relay</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Sender ID (Alpha-numeric Header)
                </label>
                <input
                  type="text"
                  value={smsConfig.senderId || 'NEXA-BANK'}
                  onChange={(e) => setSmsConfig({ ...smsConfig, senderId: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  placeholder="e.g. NEXA-BANK"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  API Key / Username / Account SID
                </label>
                <input
                  type="password"
                  value={smsConfig.apiKey || ''}
                  onChange={(e) => setSmsConfig({ ...smsConfig, apiKey: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  placeholder="Carrier API Key..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  API Secret Key / Auth Token
                </label>
                <input
                  type="password"
                  value={smsConfig.apiSecret || ''}
                  onChange={(e) => setSmsConfig({ ...smsConfig, apiSecret: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  placeholder="Carrier Secret Key..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveSmsGateway}
                disabled={isSavingSettings}
                className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                Save SMS Gateway Config
              </button>
            </div>
          </div>

          {/* Email Provider Gateway Setup */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base">✉️</span>
                  <h3 className="text-sm font-bold text-slate-900 font-sans">
                    Email Transactional Delivery Gateway
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Transactional mail delivery via SendGrid, Postmark, standard SMTP relay, or simulated sandbox.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Safe Mode / Sandbox:</span>
                <input
                  type="checkbox"
                  checked={!!emailConfig.sandboxMode}
                  onChange={(e) => setEmailConfig({ ...emailConfig, sandboxMode: e.target.checked })}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Selected Email Provider
                </label>
                <select
                  value={emailConfig.providerId || 'SANDBOX'}
                  onChange={(e) => setEmailConfig({ ...emailConfig, providerId: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="SANDBOX">Simulated Sandbox Relay (Safe)</option>
                  <option value="SENDGRID">SendGrid API</option>
                  <option value="POSTMARK">Postmark Transactional</option>
                  <option value="SMTP">Standard SMTP Server</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  From Address
                </label>
                <input
                  type="email"
                  value={emailConfig.fromEmail || 'notifications@nexa.financial'}
                  onChange={(e) => setEmailConfig({ ...emailConfig, fromEmail: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  From Sender Name
                </label>
                <input
                  type="text"
                  value={emailConfig.fromName || 'Nexa Microfinance Banking'}
                  onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  API Key / Password
                </label>
                <input
                  type="password"
                  value={emailConfig.apiKey || ''}
                  onChange={(e) => setEmailConfig({ ...emailConfig, apiKey: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  placeholder="Email service key..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveEmailGateway}
                disabled={isSavingSettings}
                className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                Save Email Gateway Config
              </button>
            </div>
          </div>

          {/* Live Test Dispatcher Tool */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🚀</span>
                <h3 className="text-sm font-bold text-slate-900 font-sans">
                  Interactive Test Dispatch & Diagnostics Tool
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate or test-fire live notifications to verify template rendering and carrier gateway connectivity.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Event Type
                </label>
                <select
                  value={testEvent}
                  onChange={(e) => setTestEvent(e.target.value as NotificationEventType)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                >
                  {settings?.rules.map((r) => (
                    <option key={r.eventType} value={r.eventType}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Test Channel
                </label>
                <select
                  value={testChannel}
                  onChange={(e) => setTestChannel(e.target.value as NotificationChannelType)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
                >
                  <option value="IN_APP">In-App Notification</option>
                  <option value="SMS">SMS Gateway</option>
                  <option value="EMAIL">Email Transmission</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Test Recipient Phone
                </label>
                <input
                  type="text"
                  value={testRecipientPhone}
                  onChange={(e) => setTestRecipientPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs font-mono"
                  placeholder="+255 7XX XXX XXX"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Test Recipient Email
                </label>
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                  placeholder="borrower@example.com"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500 font-sans">
                Sample payload: Alexander Hayes · Loan #LN-2026-6878 · TZS 10,000,000
              </span>
              <button
                onClick={handleRunTestDispatch}
                disabled={isTestDispatching}
                className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm"
              >
                {isTestDispatching ? 'Transmitting...' : `Fire Test via ${testChannel}`}
              </button>
            </div>

            {testDispatchResult && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono space-y-1">
                <span className="font-bold text-slate-800">Dispatch Response:</span>
                <pre className="text-[11px] text-slate-700 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(testDispatchResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
