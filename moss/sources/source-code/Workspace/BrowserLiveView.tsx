/**
 * 浏览器实时共驾组件
 *
 * 通过 noVNC (RFB over WebSocket) 连接到用户专属浏览器容器，
 * 展示真实 Chromium 窗口并允许用户直接操作。
 * Agent 和用户共享同一个浏览器实例 — "人机共驾"。
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Globe, Loader2, AlertCircle, RefreshCw, Maximize2, Minimize2, Radio } from 'lucide-react';

interface BrowserLiveViewProps {
  userId: string;
  isAgentOperating?: boolean;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export const BrowserLiveView: React.FC<BrowserLiveViewProps> = ({
  userId,
  isAgentOperating = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [errorMessage, setErrorMessage] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 15;

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (rfbRef.current) {
      try {
        rfbRef.current.disconnect();
      } catch {
        // ignore
      }
      rfbRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current || !containerRef.current) return;

    disconnect();
    setStatus('connecting');
    setErrorMessage('');

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws/vnc/${userId}`;

    console.log(`[BrowserLive] Connecting: ${wsUrl} (attempt ${retryCountRef.current + 1})`);

    try {
      const { default: RFB } = await import('@novnc/novnc/lib/rfb');

      if (!mountedRef.current || !containerRef.current) return;

      const rfb = new RFB(containerRef.current, wsUrl, {
        wsProtocols: ['binary'],
      });

      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.clipViewport = false;
      rfb.showDotCursor = true;
      rfb.background = '#0a0a0a';
      rfb.qualityLevel = 6;
      rfb.compressionLevel = 2;

      rfb.addEventListener('connect', () => {
        if (!mountedRef.current) return;
        console.log('[BrowserLive] Connected');
        setStatus('connected');
        retryCountRef.current = 0;
      });

      rfb.addEventListener('disconnect', (e: CustomEvent<{ clean: boolean }>) => {
        if (!mountedRef.current) return;
        const clean = e.detail?.clean ?? true;
        console.log(`[BrowserLive] Disconnected (clean: ${clean})`);
        rfbRef.current = null;
        setStatus('disconnected');

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const delay = Math.min(1000 * retryCountRef.current, 5000);
          console.log(`[BrowserLive] Reconnecting in ${delay}ms...`);
          clearReconnectTimeout();
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current) connect();
          }, delay);
        } else {
          setStatus('error');
          setErrorMessage('连接失败，已达到最大重试次数');
        }
      });

      rfb.addEventListener('securityfailure', (e: CustomEvent<{ status: number; reason: string }>) => {
        console.error('[BrowserLive] Security failure:', e.detail);
        setStatus('error');
        setErrorMessage(`安全验证失败: ${e.detail?.reason || '未知'}`);
      });

      rfbRef.current = rfb;
    } catch (err) {
      console.error('[BrowserLive] Connection error:', err);
      setStatus('error');
      setErrorMessage('无法建立 VNC 连接');

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        const delay = Math.min(1000 * retryCountRef.current, 5000);
        clearReconnectTimeout();
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
    }
  }, [userId, disconnect, clearReconnectTimeout]);

  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Init / cleanup
  useEffect(() => {
    mountedRef.current = true;

    const timer = window.setTimeout(() => {
      connect();
    }, 300);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      clearReconnectTimeout();
      disconnect();
    };
  }, [connect, clearReconnectTimeout, disconnect]);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const StatusDot = () => {
    const colors: Record<ConnectionStatus, string> = {
      connecting: '#EAB308',
      connected: '#22C55E',
      disconnected: '#71717A',
      error: '#EF4444',
    };
    const labels: Record<ConnectionStatus, string> = {
      connecting: '连接中',
      connected: '已连接',
      disconnected: '已断开',
      error: '错误',
    };

    return (
      <div className="flex items-center gap-1.5" data-testid="browser-live-view-status">
        <div
          className={status === 'connecting' ? 'animate-pulse' : status === 'connected' ? 'animate-pulse' : ''}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: colors[status],
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{labels[status]}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]" data-testid="browser-live-view" style={{ position: 'relative' }}>
      {/* Toolbar */}
      <div
        data-testid="browser-live-view-toolbar"
        className="flex items-center justify-between"
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          minHeight: 36,
        }}
      >
        <div className="flex items-center gap-2.5">
          <Globe size={15} className="text-cyan-500" />
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
            浏览器
          </span>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '1px 6px',
              borderRadius: 10,
              background: status === 'connected' ? 'rgba(34,197,94,0.12)' : 'var(--bg-tertiary)',
            }}
          >
            <Radio size={10} style={{ color: status === 'connected' ? '#22C55E' : 'var(--text-muted)' }} />
            <span style={{ fontSize: 10, color: status === 'connected' ? '#22C55E' : 'var(--text-muted)', fontWeight: 500 }}>
              LIVE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusDot />

          <button
            onClick={reconnect}
            data-testid="browser-live-view-reconnect"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="重新连接"
          >
            <RefreshCw size={13} />
          </button>

          <button
            onClick={toggleFullscreen}
            data-testid="browser-live-view-fullscreen"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={isFullscreen ? '退出全屏' : '全屏'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* VNC canvas area */}
      <div
        data-testid="browser-live-view-stage"
        className="flex-1 overflow-hidden"
        style={{ position: 'relative', background: '#0a0a0a' }}
      >
        {/* Loading overlay */}
        {status === 'connecting' && (
          <div
            data-testid="browser-live-view-loading"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 10,
              background: 'rgba(0,0,0,0.6)',
            }}
          >
            <Loader2 size={28} className="animate-spin" style={{ color: '#71717A' }} />
            <span style={{ fontSize: 13, color: '#71717A' }}>正在连接到浏览器...</span>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div
            data-testid="browser-live-view-error"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              zIndex: 10,
              background: 'rgba(0,0,0,0.6)',
            }}
          >
            <AlertCircle size={28} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: 13, color: '#F87171' }}>{errorMessage}</span>
            <button
              onClick={reconnect}
              data-testid="browser-live-view-error-retry"
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#27272A', color: '#D4D4D8', fontSize: 13 }}
            >
              <RefreshCw size={13} />
              重试
            </button>
          </div>
        )}

        {/* Agent co-pilot indicator */}
        {isAgentOperating && status === 'connected' && (
          <div
            data-testid="browser-live-view-agent-indicator"
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: 'rgba(6, 182, 212, 0.15)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
            }}
          >
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#06B6D4',
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
            <span style={{ fontSize: 11, color: '#06B6D4', fontWeight: 500 }}>
              Agent 正在操作浏览器
            </span>
          </div>
        )}

        {/* noVNC renders into this div */}
        <div
          ref={containerRef}
          data-testid="browser-live-view-canvas"
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Bottom status bar */}
      <div
        data-testid="browser-live-view-footer"
        className="flex items-center justify-between"
        style={{
          padding: '3px 12px',
          borderTop: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}
      >
        <span>1280 × 720</span>
        <span style={{ opacity: 0.5 }}>noVNC</span>
      </div>
    </div>
  );
};

export default BrowserLiveView;
