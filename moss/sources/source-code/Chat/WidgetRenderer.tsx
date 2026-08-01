/**
 * WidgetRenderer — 对话内联可视化组件
 *
 * 仅渲染已经完成的 Widget HTML。运行中的工具调用使用 AgentMessage 内的
 * WidgetPendingCard，占位态不再挂载 iframe，避免切换会话或取消任务后冻结空壳。
 *
 * 渲染策略：iframe 用 shell HTML 一次性挂载，data.code / theme 变化通过
 * postMessage（widget-replace / widget-finalize / widget-set-theme）增量更新，
 * 不重建 iframe，避免 Chart.js 重下、charts 重画、layout 抖动。
 */

import React, { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { buildWidgetHtml, buildWidgetShellHtml } from '../../lib/widgetTheme';
import { useClientTheme } from '../../lib/clientTheme';
import type { WidgetRenderData } from '../../types';
import { FineDesignTooltip } from '../common/FineDesignTooltip';

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 50000;
const DEFAULT_HEIGHT = 200;

const H2C_CDNS = [
  'https://cdn.bootcdn.net/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
];

const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js';

/**
 * Build blocking <script> tags for chart library CDNs so they load before
 * inline widget scripts that reference `Chart` or `echarts`.
 * Without this, HYDRATION_SAFETY_SCRIPT catches the ReferenceError and
 * html2canvas captures the error text in the output image.
 */
function buildChartDepsScripts(code: string): string {
  const scripts: string[] = [];
  if (/\bnew\s+Chart\s*\(|\bChart\s*\(/.test(code)) {
    scripts.push(`<script src="${CHART_JS_CDN}"></script>`);
  }
  if (/\becharts\./.test(code)) {
    scripts.push(`<script src="${ECHARTS_CDN}"></script>`);
  }
  return scripts.join('');
}

function getH2C(): any { return (window as any).html2canvas; }

async function ensureHtml2Canvas() {
  if (getH2C()) return getH2C();
  for (const cdn of H2C_CDNS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = cdn;
        s.onload = () => resolve();
        s.onerror = () => { s.remove(); reject(); };
        document.head.appendChild(s);
      });
      if (getH2C()) return getH2C();
    } catch { /* try next */ }
  }
  throw new Error('Failed to load html2canvas from all CDN sources');
}

interface WidgetRendererProps {
  data: WidgetRenderData;
  onSendPrompt?: (text: string) => void;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = memo(({ data, onSendPrompt }) => {
  const theme = useClientTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // shell 在挂载时计算一次。后续 data.code / theme 变化都通过 postMessage 增量更新，
  // 不重建 iframe — 这是消除"finalized iframe 出现瞬间卡顿"的核心。
  const [shellSrcDoc] = useState(() => buildWidgetShellHtml(theme as 'light' | 'dark'));

  const shellReadyRef = useRef(false);
  const pendingCodeRef = useRef<string | null>(null);
  const lastSentCodeRef = useRef<string | null>(null);
  const desiredThemeRef = useRef(theme);

  const sendToIframe = useCallback((message: object) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(message, '*');
  }, []);

  const flushCode = useCallback((code: string) => {
    if (lastSentCodeRef.current === code) return;
    lastSentCodeRef.current = code;
    sendToIframe({ type: 'widget-replace', html: code });
    sendToIframe({ type: 'widget-finalize' });
  }, [sendToIframe]);

  const handleIframeLoad = useCallback(() => {
    shellReadyRef.current = true;
    // shell 加载完成后同步当前 desired theme（防止 mount → load 之间主题已切换）
    sendToIframe({ type: 'widget-set-theme', theme: desiredThemeRef.current });
    if (pendingCodeRef.current) {
      flushCode(pendingCodeRef.current);
      pendingCodeRef.current = null;
    }
  }, [flushCode, sendToIframe]);

  // data.code 到达 / 变化 → 通过 postMessage 注入；shell 还没 ready 就先入队
  useEffect(() => {
    if (!data.code) return;
    if (shellReadyRef.current) {
      flushCode(data.code);
    } else {
      pendingCodeRef.current = data.code;
    }
  }, [data.code, flushCode]);

  // theme 切换 → 热切换 data-theme 属性，不重建 iframe
  useEffect(() => {
    desiredThemeRef.current = theme;
    if (shellReadyRef.current) {
      sendToIframe({ type: 'widget-set-theme', theme });
    }
  }, [theme, sendToIframe]);

  const handleDownload = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    console.log('[WidgetDownload] starting parent-side capture');

    let hidden: HTMLIFrameElement | null = null;
    try {
      const html2canvas = await ensureHtml2Canvas();
      console.log('[WidgetDownload] html2canvas ready');

      let captureHtml = buildWidgetHtml(data.code, theme as 'light' | 'dark');
      // 注入 Chart.js / ECharts CDN（阻塞式 <script>，确保在 widget 内联脚本之前加载）
      const depsScripts = buildChartDepsScripts(data.code);
      if (depsScripts) {
        captureHtml = captureHtml.replace('</head>', depsScripts + '</head>');
      }

      const visibleWidth = iframeRef.current?.offsetWidth || 800;
      hidden = document.createElement('iframe');
      hidden.style.cssText = `position:fixed;left:-9999px;top:0;width:${visibleWidth}px;height:100px;border:none;`;
      document.body.appendChild(hidden);

      await new Promise<void>(resolve => {
        hidden!.onload = () => setTimeout(resolve, 1000);
        hidden!.srcdoc = captureHtml;
      });

      const doc = hidden.contentDocument!;
      const body = doc.body;
      if (!body) throw new Error('Cannot access hidden iframe body');

      // Force all animations/transitions to complete instantly
      const snap = doc.createElement('style');
      snap.textContent = '*, *::before, *::after { animation-delay:0s!important; animation-duration:0s!important; animation-fill-mode:forwards!important; transition-delay:0s!important; transition-duration:0s!important; }';
      doc.head.appendChild(snap);

      body.style.padding = '0';
      body.style.overflow = 'visible';

      // Force reflow then wait for layout to settle
      void body.offsetHeight;
      await new Promise(r => setTimeout(r, 300));

      // Resize iframe to actual content dimensions
      const docEl = doc.documentElement;
      const contentHeight = Math.ceil(Math.max(body.scrollHeight, docEl.scrollHeight, body.offsetHeight, docEl.offsetHeight));
      const contentWidth = Math.ceil(Math.max(body.scrollWidth, docEl.scrollWidth, body.offsetWidth, docEl.offsetWidth)) + 2;
      hidden.style.width = contentWidth + 'px';
      hidden.style.height = contentHeight + 'px';

      // One more reflow after resize
      void body.offsetHeight;
      await new Promise(r => setTimeout(r, 100));

      const bgColor = getComputedStyle(doc.documentElement)
        .getPropertyValue('--bg-primary').trim() || (theme === 'dark' ? '#0A0A0F' : '#FAF9F7');

      console.log('[WidgetDownload] capturing', contentWidth, 'x', contentHeight, 'bg:', bgColor);
      const canvas = await html2canvas(body, {
        backgroundColor: bgColor,
        useCORS: true,
        scale: Math.min(window.devicePixelRatio || 2, 3),
        logging: false,
        width: contentWidth,
        height: contentHeight,
        windowWidth: contentWidth,
        windowHeight: contentHeight,
        scrollX: 0,
        scrollY: 0,
      });

      canvas.toBlob((blob: Blob | null) => {
        if (!blob) { console.error('[WidgetDownload] toBlob returned null'); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${data.title || 'widget'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        console.log('[WidgetDownload] download triggered, blob size:', blob.size);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } catch (err) {
      console.error('[WidgetDownload] error:', err);
    } finally {
      if (hidden) document.body.removeChild(hidden);
      setIsCapturing(false);
    }
  }, [isCapturing, data.code, data.title, theme]);

  // --- Message handling (resize + sendPrompt) ---
  const handleMessage = useCallback((e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.source !== iframeRef.current?.contentWindow) return;
    if (e.data.type === 'widget-resize' && typeof e.data.height === 'number') {
      const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.ceil(e.data.height)));
      setHeight(h);
      if (!loaded) setLoaded(true);
    }
    if (e.data.type === 'widget-send-prompt' && typeof e.data.text === 'string') {
      onSendPrompt?.(e.data.text);
    }
    if (e.data.type === 'widget-fullscreen') {
      const el = iframeRef.current;
      if (!el) return;
      if (e.data.enter) {
        el.requestFullscreen?.().catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
  }, [loaded, onSendPrompt]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    const onFSChange = () => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'widget-fullscreen-change', isFullscreen: !!document.fullscreenElement },
        '*'
      );
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, []);

  // Fallback timeout: 若 widget-resize 始终没触发（charts 渲染失败 / iframe 异常），
  // 3s 后强制把 loading overlay 摘掉，避免 shimmer 永远转。
  useEffect(() => {
    const timer = setTimeout(() => { if (!loaded) setLoaded(true); }, 3000);
    return () => clearTimeout(timer);
  }, [loaded]);

  if (error) {
    return (
      <div
        data-testid="widget-renderer-error"
        className="my-3 rounded-lg"
        style={{
          padding: 14,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        Widget 渲染失败：{data.title || '未知'}
      </div>
    );
  }

  return (
    <div
      data-testid="widget-renderer"
      className="my-3 rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        position: 'relative',
      }}
    >
      {data.title && (
        <div
          data-testid="widget-renderer-header"
          className="flex items-center justify-between px-3 py-1.5"
          style={{ borderBottom: '1px solid var(--border-subtle)', gap: 8 }}
        >
          <span
            style={{
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-muted)',
            }}
          >
            {data.title}
          </span>
          {loaded && (
            <DownloadButton
              placement="inline"
              isDark={theme === 'dark'}
              isCapturing={isCapturing}
              onClick={handleDownload}
            />
          )}
        </div>
      )}

      {loaded && !data.title && (
        <DownloadButton
          placement="floating"
          isDark={theme === 'dark'}
          isCapturing={isCapturing}
          onClick={handleDownload}
        />
      )}

      <div style={{ position: 'relative', minHeight: loaded ? undefined : DEFAULT_HEIGHT }}>
        {!loaded && (
          <div
            data-testid="widget-renderer-loading"
            className="widget-loading-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              background: 'var(--bg-secondary)',
              overflow: 'hidden',
            }}
          >
            <div className="widget-shimmer-layer" />
            <WidgetLoadingStyles />
          </div>
        )}

        <iframe
          ref={iframeRef}
          srcDoc={shellSrcDoc}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          onLoad={handleIframeLoad}
          data-testid="widget-renderer-frame"
          style={{
            width: '100%',
            height,
            border: 'none',
            display: 'block',
            opacity: loaded ? 1 : 0,
            // 不给 height 加 transition：父侧 setHeight 是即时数据更新，
            // 0.25s 缓动会把 ResizeObserver 的微抖放大成视觉上的"持续拉高"
            transition: 'opacity 0.4s ease',
          }}
          title={data.title || 'Widget'}
          onError={() => setError(true)}
        />
      </div>
    </div>
  );
});

WidgetRenderer.displayName = 'WidgetRenderer';

const DownloadButton: React.FC<{
  placement: 'inline' | 'floating';
  isDark: boolean;
  isCapturing: boolean;
  onClick: () => void;
}> = ({ placement, isDark, isCapturing, onClick }) => {
  const tooltipId = useId();
  const bg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const bgHover = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.09)';
  const border = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)';
  const iconColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.4)';
  const iconColorHover = isDark ? '#fff' : 'rgba(0,0,0,0.65)';
  const spinStroke = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  const isFloating = placement === 'floating';

  return (
    // Reuse the shared portal tooltip so the download hint matches session actions
    // and cannot be clipped by the widget card's overflow-hidden shell.
    <FineDesignTooltip
      content="下载为图片"
      placement="bottom"
      tooltipId={tooltipId}
      testId="widget-renderer-download"
      wrapperStyle={{
        position: isFloating ? 'absolute' : 'relative',
        top: isFloating ? 6 : undefined,
        right: isFloating ? 6 : undefined,
        zIndex: isFloating ? 10 : undefined,
        display: 'inline-flex',
        flexShrink: 0,
      }}
    >
      <button
        onClick={onClick}
        disabled={isCapturing}
        data-testid="widget-renderer-download"
        aria-label="下载为图片"
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border,
          cursor: isCapturing ? 'wait' : 'pointer',
          background: bg,
          backdropFilter: 'blur(8px)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = bgHover;
          const svg = e.currentTarget.querySelector('svg');
          if (svg) svg.style.color = iconColorHover;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = bg;
          const svg = e.currentTarget.querySelector('svg');
          if (svg) svg.style.color = iconColor;
        }}
      >
        {isCapturing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 1s linear infinite', color: iconColor }}>
            <circle cx="7" cy="7" r="5.5" stroke={spinStroke} strokeWidth="1.5" fill="none" />
            <path d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: iconColor }}>
            <path d="M7 1.75v7m0 0L4.25 6M7 8.75l2.75-2.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.5 11.25h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        )}
      </button>
    </FineDesignTooltip>
  );
};

const WidgetLoadingStyles: React.FC = () => (
  <style>{`
    .widget-shimmer-layer {
      position: absolute; inset: 0; z-index: 1;
      background: linear-gradient(135deg, transparent 0%, transparent 30%, var(--widget-shimmer-highlight, rgba(255,255,255,0.12)) 50%, transparent 70%, transparent 100%);
      background-size: 400% 400%;
      animation: widget-shimmer 2s ease-in-out infinite;
    }
    [data-theme="light"] .widget-shimmer-layer { --widget-shimmer-highlight: rgba(0,0,0,0.06); }
    [data-theme="dark"] .widget-shimmer-layer { --widget-shimmer-highlight: rgba(255,255,255,0.09); }
    .widget-loading-overlay { animation: widget-overlay-in 0.3s ease-out forwards; }
    @keyframes widget-shimmer { 0% { background-position: 100% 100%; } 100% { background-position: 0% 0%; } }
    @keyframes widget-overlay-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `}</style>
);
