import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
import { NotificationDTO } from '../../../shared/types/index.js';

interface NotificationBellProps {
  onOpenFullCenter?: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenFullCenter }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnread = async () => {
    try {
      const data = await api.notifications.getAll({ pageSize: 5 });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      // Quiet fail if not authenticated yet
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.notifications.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString(), status: 'READ' } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    try {
      await api.notifications.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString(), status: 'READ' }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'SMS':
        return '📱';
      case 'EMAIL':
        return '✉️';
      default:
        return '🔔';
    }
  };

  const getEventBadge = (eventType: string) => {
    if (eventType.includes('APPROVED') || eventType.includes('COMPLETED')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (eventType.includes('REJECTED') || eventType.includes('OVERDUE') || eventType.includes('FAILED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (eventType.includes('DISBURSED') || eventType.includes('RECEIVED')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatTimeAgo = (dateStr: string) => {
    const ms = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchUnread();
        }}
        className="relative p-1.5 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-900"
        title="Notifications & Alerts"
        aria-label="View notifications"
      >
        <span className="text-base select-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-1 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-xl ring-1 ring-slate-900/10 z-50 overflow-hidden border border-slate-200 animate-in fade-in-50 duration-150">
          {/* Header */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={isLoading}
                className="text-[11px] text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-sans">
                <p className="text-xl mb-1">📭</p>
                <p className="text-xs font-medium">No recent notifications</p>
                <p className="text-[11px] text-slate-400 mt-0.5">You're all caught up on alerts</p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.readAt;
                return (
                  <div
                    key={item.id}
                    className={`p-3 transition-colors flex gap-2.5 items-start ${
                      isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm mt-0.5 select-none">{getChannelIcon(item.channel)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-900 truncate text-[11px]">
                          {item.subject}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                          {formatTimeAgo(item.createdAt || item.sentAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold border ${getEventBadge(
                            item.eventType
                          )}`}
                        >
                          {item.channel} · {item.eventType.replace(/_/g, ' ')}
                        </span>
                        {isUnread && (
                          <button
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                if (onOpenFullCenter) onOpenFullCenter();
              }}
              className="w-full py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            >
              Open Notification Center & Gateways →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
