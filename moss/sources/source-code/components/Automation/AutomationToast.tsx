/**
 * 自动化任务完成 Toast 通知
 *
 * 右上角弹出，5s 自动关闭，点击新开页面查看会话。
 * 极简黑白风格。标题突出，正文弱化。
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  getAutomationNotificationStatus,
  markNotificationRead,
  normalizeNotification,
  type AppNotification,
  type PlatformNotificationItem,
} from '../../api/automations';
import { randomId } from '../../lib/id';
import { useUiStore } from '../../stores/uiStore';

interface ToastEntry {
  id: string;
  notification: AppNotification;
  entering: boolean;
  leaving: boolean;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '刚刚';
  const utcStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(utcStr).getTime();
  if (diff < 0 || diff < 60_000) return '刚刚';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return new Date(utcStr).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function cleanContent(raw: string): string {
  return raw
    .replace(/\[\[TASK[_\s]*COMPLETE\]\]/gi, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

const toTestIdSegment = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

const AutomationToast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const ensureAutomationOpen = useUiStore(s => s.ensureAutomationOpen);

  const clearAutoDismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    clearAutoDismiss(id);
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, [clearAutoDismiss]);

  const scheduleAutoDismiss = useCallback((id: string) => {
    clearAutoDismiss(id);
    const timer = setTimeout(() => {
      dismiss(id);
    }, 5000);
    timersRef.current.set(id, timer);
  }, [clearAutoDismiss, dismiss]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const notif = normalizeNotification((detail.data ?? detail) as PlatformNotificationItem);
      if (!notif.type?.startsWith('automation_')) return;

      const entry: ToastEntry = {
        id: notif.id || randomId(),
        notification: notif,
        entering: true,
        leaving: false,
      };
      setToasts(prev => [...prev, entry]);
      requestAnimationFrame(() => {
        setToasts(prev => prev.map(t => t.id === entry.id ? { ...t, entering: false } : t));
      });
      scheduleAutoDismiss(entry.id);

      window.dispatchEvent(new CustomEvent('asset-changed', { detail: { type: 'automations' } }));
    };

    window.addEventListener('ws-notification', handler);
    return () => {
      window.removeEventListener('ws-notification', handler);
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [scheduleAutoDismiss]);

  const handleClick = async (toast: ToastEntry) => {
    const n = toast.notification;
    try { await markNotificationRead(n.id); } catch { /* ignore */ }
    if (n.reference_type === 'session' && n.reference_id) {
      window.open(`/s/${n.reference_id}`, '_blank');
    } else if (n.reference_type === 'automation_pipeline' && n.reference_id) {
      ensureAutomationOpen(n.reference_id);
    }
    dismiss(toast.id);
  };

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="automation-toast-region"
      style={{
      position: 'fixed', top: 60, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map((toast) => {
        const n = toast.notification;
        const status = getAutomationNotificationStatus(n);
        const success = status === 'success';
        const title = (n.title || '').replace(/^\[自动化\]\s*/, '');
        const summary = cleanContent(n.summary || '');
        const toastId = toTestIdSegment(toast.id);

        return (
          <div
            key={toast.id}
            className="automation-toast-item"
            data-testid={`automation-toast-item-${toastId}`}
            onClick={() => handleClick(toast)}
            onMouseEnter={() => clearAutoDismiss(toast.id)}
            onMouseLeave={() => {
              if (!toast.leaving) scheduleAutoDismiss(toast.id);
            }}
            style={{
              pointerEvents: 'auto',
              width: 340,
              borderRadius: 14,
              background: 'var(--sidebar-bg, #1a1a2e)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
              padding: '16px 18px',
              cursor: 'pointer',
              opacity: toast.entering || toast.leaving ? 0 : 1,
              transform: toast.entering
                ? 'translateX(40px) scale(0.96)'
                : toast.leaving
                ? 'translateX(20px) scale(0.97)'
                : 'translateX(0) scale(1)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)',
            }}
          >
            {/* 标题（视觉重心） */}
            <div data-testid={`automation-toast-title-${toastId}`} style={{
              fontSize: 14, fontWeight: 600, lineHeight: 1.35,
              color: 'var(--text-primary)',
              marginBottom: summary ? 6 : 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {title}
            </div>

            {/* 正文摘要（弱化，最多2行） */}
            {summary && (
              <div style={{
                fontSize: 12, lineHeight: 1.5,
                color: 'var(--text-tertiary)',
                marginBottom: 10,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }}>
                {summary}
              </div>
            )}

            {/* 底栏：状态 */}
            <div data-testid={`automation-toast-status-${toastId}`} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              paddingTop: 10,
              borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
            }}>
              {success ? (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              ) : (
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
                </svg>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {status === 'success' ? '执行完成' : status === 'failed' ? '执行异常' : '执行状态更新'}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-quaternary, #555)' }}>
                {timeAgo(n.created_at)}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-quaternary, #555)' }}>
                查看详情
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AutomationToast;
