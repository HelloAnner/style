/**
 * 通知铃铛组件
 * 
 * 显示未读通知数量，点击展开通知面板。
 * 通过 WebSocket 接收实时推送更新计数。
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AnimatePresence } from '../../lib/motion';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, AlertCircle, X, Check } from 'lucide-react';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  normalizeNotification,
  type AppNotification,
  type PlatformNotificationItem,
} from '../../api/automations';

// ── Notification type icon ──────────────────────────

const NotifIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type === 'automation_completed') return <CheckCircle size={14} style={{ color: '#22c55e' }} />;
  if (type === 'automation_failed') return <AlertCircle size={14} style={{ color: '#ef4444' }} />;
  return <Bell size={14} style={{ color: '#818cf8' }} />;
};

// ── Time ago formatter ──────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

// ── NotificationPanel ───────────────────────────────

interface PanelProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
  onNavigate: (sessionId: string) => void;
}

const NotificationPanel: React.FC<PanelProps> = ({ notifications, onMarkRead, onMarkAllRead, onClose, onNavigate }) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <motion.div
      ref={panelRef}
      data-testid="notification-panel"
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 8,
        width: 320,
        maxHeight: 400,
        borderRadius: 12,
        background: 'var(--sidebar-bg)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        data-testid="notification-panel-header"
        style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>通知</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {notifications.some(n => !n.is_read) && (
            <button
              onClick={onMarkAllRead}
              data-testid="notification-panel-mark-all"
              style={{
                fontSize: 11, color: 'var(--text-secondary)',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
              className="hover:text-white transition-colors"
            >
              <Check size={11} /> 全部已读
            </button>
          )}
          <button
            onClick={onClose}
            data-testid="notification-panel-close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="notification-panel-list" style={{ overflowY: 'auto', maxHeight: 340 }}>
        {notifications.length === 0 ? (
          <div className="notification-panel-empty" style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
            暂无通知
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              className="notification-panel-item hover:bg-white/5 transition-colors"
              data-testid={`notification-panel-item-${n.id}`}
              onClick={() => {
                if (!n.is_read) onMarkRead(n.id);
                if (n.reference_type === 'session' && n.reference_id) {
                  onNavigate(n.reference_id);
                  onClose();
                }
              }}
              style={{
                display: 'flex', gap: 8,
                padding: '10px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                background: n.is_read ? 'transparent' : 'rgba(129,140,248,0.04)',
              }}
            >
              <div style={{ paddingTop: 2 }}>
                <NotifIcon type={n.type} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  fontWeight: n.is_read ? 400 : 500,
                  lineHeight: '1.3',
                }}>
                  {n.title}
                </div>
                {n.summary && (
                  <div style={{
                    fontSize: 11, color: 'var(--text-tertiary)',
                    marginTop: 2, lineHeight: '1.3',
                    maxHeight: 32, overflow: 'hidden',
                  }}>
                    {n.summary.slice(0, 100)}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-quaternary)', marginTop: 3 }}>
                  {timeAgo(n.created_at)}
                </div>
              </div>
              {!n.is_read && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#818cf8', flexShrink: 0, marginTop: 4,
                }} />
              )}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

// ── Main NotificationBell ───────────────────────────

export const NotificationBell: React.FC = () => {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const navigate = useNavigate();

  const fetchCount = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setCount(data.count);
    } catch {
      // ignore
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await listNotifications();
      setNotifications(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Listen for WebSocket notification pushes
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const data = e.detail;
      if (data?.type === 'notification') {
        setCount(prev => prev + 1);
        if (open) {
          setNotifications(prev => [normalizeNotification(data.data as PlatformNotificationItem), ...prev]);
        }
      }
    };
    window.addEventListener('ws-notification', handler as EventListener);
    return () => window.removeEventListener('ws-notification', handler as EventListener);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setCount(prev => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <div className="notification-bell" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        className="hover:bg-white/10 transition-colors"
        data-testid="notification-bell-trigger"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: count > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
          position: 'relative',
        }}
        title="通知"
      >
        <Bell size={16} />
        {count > 0 && (
          <span
            data-testid="notification-bell-count"
            style={{
            position: 'absolute', top: 2, right: 2,
            minWidth: 14, height: 14,
            borderRadius: 7, fontSize: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#ef4444', color: '#fff',
            fontWeight: 600, lineHeight: 1,
            padding: '0 3px',
          }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <NotificationPanel
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkAllRead={handleMarkAllRead}
            onClose={() => setOpen(false)}
            onNavigate={(sessionId) => navigate(`/s/${sessionId}`)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
