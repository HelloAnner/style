/**
 * ShareDialog - 会话分享卡片
 *
 * 点击分享按钮后弹出的分享卡片，支持：
 * - 企业内分享链接和公开分享链接分别生成、复制、打开、关闭
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { track } from '../../utils/track';
import { kernelApiFetch } from '../../api/gateway';
import { useAgentStore } from '../../stores/agentStore';
import { SharePopover, type SharePopoverItem, type SharePopoverItemType } from '../common/SharePopover';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  anchorRect?: DOMRect | null;
  sessionIdOverride?: string | null;
}

type ShareType = SharePopoverItemType;

interface ShareRecord {
  token: string;
  share_type?: ShareType;
  share_url?: string;
  is_active?: boolean;
}

interface ShareItemState {
  url: string;
  token: string;
  loading: boolean;
  copied: boolean;
  error: string;
}

const emptyShareItem = (): ShareItemState => ({
  url: '',
  token: '',
  loading: false,
  copied: false,
  error: '',
});

// navigator.clipboard 仅在安全上下文（HTTPS / localhost）可用，
// 测试环境走 HTTP 时回退到 execCommand，避免 TypeError 中断流程。
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function shareUrlFromRecord(record: ShareRecord | null | undefined): string {
  if (!record?.token) return '';
  return `${window.location.origin}/share/${record.token}`;
}

function toItemState(record: ShareRecord | null | undefined): ShareItemState {
  if (!record?.token) return emptyShareItem();
  return {
    ...emptyShareItem(),
    token: record.token,
    url: shareUrlFromRecord(record),
  };
}

export const ShareDialog: React.FC<ShareDialogProps> = ({ open, onClose, anchorRect, sessionIdOverride }) => {
  const storeCurrentSessionId = useAgentStore((s) => s.currentSessionId);
  const sessions = useAgentStore((s) => s.sessions);
  const currentSessionId = sessionIdOverride !== undefined ? sessionIdOverride : storeCurrentSessionId;

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  const [shares, setShares] = useState<Record<ShareType, ShareItemState>>({
    enterprise: emptyShareItem(),
    public: emptyShareItem(),
  });
  const lastSessionIdRef = useRef<string | null>(null);
  const copyResetTimerRef = useRef<Record<ShareType, number | null>>({
    enterprise: null,
    public: null,
  });

  const clearCopyResetTimer = useCallback((type: ShareType) => {
    const timer = copyResetTimerRef.current[type];
    if (timer !== null) {
      window.clearTimeout(timer);
      copyResetTimerRef.current[type] = null;
    }
  }, []);

  const updateShareItem = useCallback((type: ShareType, patch: Partial<ShareItemState>) => {
    setShares((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...patch },
    }));
  }, []);

  const resetCopiedState = useCallback((type?: ShareType) => {
    if (type) {
      clearCopyResetTimer(type);
      updateShareItem(type, { copied: false });
      return;
    }
    (['enterprise', 'public'] as ShareType[]).forEach((itemType) => {
      clearCopyResetTimer(itemType);
    });
    setShares((prev) => ({
      enterprise: { ...prev.enterprise, copied: false },
      public: { ...prev.public, copied: false },
    }));
  }, [clearCopyResetTimer, updateShareItem]);

  const markCopied = useCallback((type: ShareType, delayMs = 2000) => {
    clearCopyResetTimer(type);
    updateShareItem(type, { copied: true });
    copyResetTimerRef.current[type] = window.setTimeout(() => {
      updateShareItem(type, { copied: false });
      copyResetTimerRef.current[type] = null;
    }, delayMs);
  }, [clearCopyResetTimer, updateShareItem]);

  useEffect(() => {
    if (!open) {
      resetCopiedState();
      return;
    }
    if (!currentSession) return;

    const sid = currentSession.id;
    if (sid !== lastSessionIdRef.current) {
      lastSessionIdRef.current = sid;
      setShares({
        enterprise: emptyShareItem(),
        public: emptyShareItem(),
      });
    }
    resetCopiedState();
  }, [open, currentSession, resetCopiedState]);

  useEffect(() => {
    if (!open || !currentSessionId) return;
    let cancelled = false;

    const loadShareLinks = async () => {
      try {
        const res = await kernelApiFetch(`/api/v1/share/session/${currentSessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setShares({
          enterprise: toItemState(data.enterprise),
          public: toItemState(data.public),
        });
      } catch {
        if (!cancelled) {
          setShares((prev) => ({
            enterprise: { ...prev.enterprise, error: '' },
            public: { ...prev.public, error: '' },
          }));
        }
      }
    };

    loadShareLinks();
    return () => { cancelled = true; };
  }, [open, currentSessionId]);

  useEffect(() => () => {
    (['enterprise', 'public'] as ShareType[]).forEach(clearCopyResetTimer);
  }, [clearCopyResetTimer]);

  const handleEnable = useCallback(async (type: ShareType) => {
    if (!currentSessionId) return;
    updateShareItem(type, { loading: true, error: '' });
    try {
      const res = await kernelApiFetch('/api/v1/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          share_type: type,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || '创建分享失败');
      }
      const data = await res.json();
      const url = data.token ? `${window.location.origin}/share/${data.token}` : '';
      if (!url) throw new Error('分享链接生成失败:服务端未返回 token');
      updateShareItem(type, {
        token: data.token,
        url,
        loading: false,
        error: '',
        copied: false,
      });
      resetCopiedState(type);
    } catch (e: any) {
      updateShareItem(type, {
        loading: false,
        error: e.message || '创建分享失败',
      });
    }
  }, [currentSessionId, updateShareItem, resetCopiedState]);

  const handleDisable = useCallback(async (type: ShareType) => {
    const token = shares[type].token;
    if (!token) return;
    updateShareItem(type, { loading: true, error: '' });
    try {
      const res = await kernelApiFetch(`/api/v1/share/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || '关闭分享失败');
      }
      clearCopyResetTimer(type);
      updateShareItem(type, emptyShareItem());
    } catch (e: any) {
      updateShareItem(type, {
        loading: false,
        error: e.message || '关闭分享失败',
      });
    }
  }, [shares, updateShareItem, clearCopyResetTimer]);

  const handleToggle = (type: ShareType) => {
    if (shares[type].url) {
      handleDisable(type);
    } else {
      handleEnable(type);
    }
  };

  const handleCopy = useCallback((type: ShareType) => {
    track('share_session', { sub_event: type === 'enterprise' ? 'enterprise_share_copy' : 'public_share_copy' });
    const url = shares[type].url;
    if (!url) return;
    clearCopyResetTimer(type);
    writeClipboard(url).then((ok) => {
      if (ok) {
        markCopied(type);
      } else {
        updateShareItem(type, { error: '复制失败，请手动复制链接' });
      }
    });
  }, [shares, clearCopyResetTimer, markCopied, updateShareItem]);

  const handleOpen = useCallback((type: ShareType) => {
    const url = shares[type].url;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [shares]);

  const shareItems: SharePopoverItem[] = [
    { type: 'enterprise', label: '企业内分享', ...shares.enterprise, disabled: !currentSessionId },
    { type: 'public', label: '公开分享', ...shares.public, disabled: !currentSessionId },
  ];

  if (!open) return null;

  return (
    <SharePopover
      open={open}
      title="分享会话"
      anchorRect={anchorRect}
      zIndex={60}
      testId="share-dialog"
      backdropTestId="share-dialog-backdrop"
      items={shareItems}
      onClose={onClose}
      onToggle={handleToggle}
      onCopy={handleCopy}
      onOpen={handleOpen}
    />
  );
};
