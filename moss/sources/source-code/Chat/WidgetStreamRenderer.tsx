import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { buildWidgetShellHtml } from '../../lib/widgetTheme';
import { useClientTheme } from '../../lib/clientTheme';
import { isWidgetStreamPreviewReady } from '../../lib/widgetStreamPreview';
import { useFrontendConfigStore } from '../../stores/frontendConfigStore';
import type { PendingToolCall, WidgetStreamState } from '../../types';

const MIN_HEIGHT = 60;
const MAX_HEIGHT = 50000;
const DEFAULT_HEIGHT = 200;
const SKELETON_MIN_HEIGHT = 320;
const TIMER_GRACE_MS = 3000;

interface WidgetStreamRendererProps {
  tool: PendingToolCall;
  stream: WidgetStreamState;
  onSendPrompt?: (text: string) => void;
}

export const WidgetStreamRenderer: React.FC<WidgetStreamRendererProps> = memo(({
  tool,
  stream,
  onSendPrompt,
}) => {
  const theme = useClientTheme();
  const showToolDurations = useFrontendConfigStore((state) => state.showToolDurations);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const streamIdRef = useRef(stream.streamId);
  const shellReadyRef = useRef(false);
  const streamStartedRef = useRef(false);
  const sentSeqRef = useRef(0);
  const finalizedSeqRef = useRef(0);
  const desiredThemeRef = useRef(theme);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [loaded, setLoaded] = useState(false);
  const [shellSrcDoc] = useState(() => buildWidgetShellHtml(theme as 'light' | 'dark'));
  const elapsedSec = useElapsedSeconds(tool.started_at, !stream.completed && !stream.aborted);
  const previewTitle = tool.argPreview?.title;
  const title = previewTitle || tool.display_name || '绘制中';
  const bodyText = latestLoadingMessage(tool) || (previewTitle ? `正在绘制 "${previewTitle}"…` : '正在绘制…');
  const previewReady = isWidgetStreamPreviewReady(stream);
  const iframeVisible = loaded && previewReady;
  const frameHeight = iframeVisible ? height : Math.max(height, SKELETON_MIN_HEIGHT);

  const sendToIframe = useCallback((message: object) => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  const flushStream = useCallback(() => {
    if (streamIdRef.current !== stream.streamId) {
      streamIdRef.current = stream.streamId;
      streamStartedRef.current = false;
      sentSeqRef.current = 0;
      finalizedSeqRef.current = 0;
      setLoaded(false);
    }
    if (!shellReadyRef.current) return;
    if (stream.markup) {
      if (stream.seq > sentSeqRef.current) {
        sentSeqRef.current = stream.seq;
        sendToIframe({ type: 'widget-replace', html: buildPreviewHtml(stream) });
      }
    } else if (!streamStartedRef.current) {
      streamStartedRef.current = true;
    }
    if (stream.completed && finalizedSeqRef.current < stream.seq) {
      finalizedSeqRef.current = stream.seq;
      sendToIframe({ type: 'widget-finalize' });
    }
    if (stream.aborted) {
      sendToIframe({ type: 'widget-stream-abort' });
    }
  }, [sendToIframe, stream]);

  const handleIframeLoad = useCallback(() => {
    shellReadyRef.current = true;
    sendToIframe({ type: 'widget-set-theme', theme: desiredThemeRef.current });
    flushStream();
  }, [flushStream, sendToIframe]);

  useEffect(() => {
    flushStream();
  }, [flushStream]);

  useEffect(() => {
    desiredThemeRef.current = theme;
    if (shellReadyRef.current) {
      sendToIframe({ type: 'widget-set-theme', theme });
    }
  }, [sendToIframe, theme]);

  useEffect(() => {
    if (!previewReady || loaded) return undefined;
    const timer = setTimeout(() => setLoaded(true), 180);
    return () => clearTimeout(timer);
  }, [previewReady, loaded]);

  const handleMessage = useCallback((e: MessageEvent) => {
    if (!e.data || typeof e.data !== 'object') return;
    if (e.source !== iframeRef.current?.contentWindow) return;
    if (e.data.type === 'widget-resize' && typeof e.data.height === 'number') {
      const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.ceil(e.data.height)));
      setHeight(h);
      if (previewReady) {
        setLoaded(true);
      }
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
  }, [previewReady, onSendPrompt]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return (
    <div className="my-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', position: 'relative' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>
          {title}
        </span>
        {showToolDurations && elapsedSec !== null && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-muted)',
              flexShrink: 0,
              marginLeft: 12,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {elapsedSec}s
          </span>
        )}
      </div>
      <div style={{ position: 'relative', minHeight: loaded ? undefined : SKELETON_MIN_HEIGHT }}>
        <WidgetStreamSkeleton
          title={title}
          bodyText={bodyText}
          hidden={iframeVisible}
        />
        <iframe
          ref={iframeRef}
          srcDoc={shellSrcDoc}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
          onLoad={handleIframeLoad}
          style={{
            width: '100%',
            height: frameHeight,
            border: 'none',
            display: 'block',
            opacity: iframeVisible ? 1 : 0,
            transition: stream.completed
              ? 'opacity 0.35s ease'
              : 'opacity 0.35s ease, height 0.18s ease-out',
          }}
          title={title}
        />
      </div>
    </div>
  );
});

WidgetStreamRenderer.displayName = 'WidgetStreamRenderer';

function useElapsedSeconds(startedAt: string | undefined, running: boolean): number | null {
  const fallbackStartRef = useRef(Date.now());
  const [elapsedSec, setElapsedSec] = useState<number | null>(null);

  useEffect(() => {
    if (!running) {
      setElapsedSec(null);
      return undefined;
    }
    const parsedStart = startedAt ? new Date(startedAt).getTime() : NaN;
    const startMs = Number.isFinite(parsedStart) ? parsedStart : fallbackStartRef.current;
    const tick = () => {
      const elapsed = Date.now() - startMs;
      setElapsedSec(elapsed >= TIMER_GRACE_MS ? Math.floor(elapsed / 1000) : null);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  return elapsedSec;
}

function WidgetStreamSkeleton({
  title,
  bodyText,
  hidden,
}: {
  title: string;
  bodyText: string;
  hidden: boolean;
}) {
  return (
    <>
      <div
        data-testid="widget-stream-skeleton"
        role={hidden ? undefined : 'status'}
        aria-live="polite"
        aria-hidden={hidden}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          color: 'var(--text-muted)',
          background: 'var(--bg-secondary)',
          opacity: hidden ? 0 : 1,
          pointerEvents: 'none',
          transition: 'opacity 0.35s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ width: 'min(48%, 320px)', height: 16, borderRadius: 4 }} className="widget-stream-skeleton-block" />
            <div style={{ width: 'min(32%, 210px)', height: 8, borderRadius: 4, marginTop: 10 }} className="widget-stream-skeleton-block" />
          </div>
          <div style={{ width: 72, height: 28, borderRadius: 6 }} className="widget-stream-skeleton-block" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          {[0, 1, 2, 3].map(index => (
            <div
              key={index}
              style={{
                minHeight: 64,
                border: '1px solid var(--border-subtle)',
                borderRadius: 8,
                padding: 10,
                background: 'var(--bg-primary)',
              }}
            >
              <div style={{ width: '38%', height: 8, borderRadius: 4 }} className="widget-stream-skeleton-block" />
              <div style={{ width: '62%', height: 14, borderRadius: 4, marginTop: 14 }} className="widget-stream-skeleton-block" />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 12, minHeight: 92 }}>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, background: 'var(--bg-primary)' }}>
            <div style={{ width: '28%', height: 9, borderRadius: 4 }} className="widget-stream-skeleton-block" />
            <div style={{ height: 46, borderRadius: 6, marginTop: 16 }} className="widget-stream-skeleton-chart" />
          </div>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12, background: 'var(--bg-primary)' }}>
            <div style={{ width: '42%', height: 9, borderRadius: 4 }} className="widget-stream-skeleton-block" />
            <div style={{ width: '88%', height: 8, borderRadius: 4, marginTop: 16 }} className="widget-stream-skeleton-block" />
            <div style={{ width: '68%', height: 8, borderRadius: 4, marginTop: 10 }} className="widget-stream-skeleton-block" />
          </div>
        </div>

        <div style={{ fontSize: 12, lineHeight: '18px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bodyText || title}
        </div>
      </div>
      <style>{`
        .widget-stream-skeleton-block,
        .widget-stream-skeleton-chart {
          position: relative;
          overflow: hidden;
          background: var(--bg-tertiary);
        }
        .widget-stream-skeleton-block::after,
        .widget-stream-skeleton-chart::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background: linear-gradient(90deg, transparent, var(--widget-skeleton-highlight, rgba(0,0,0,0.06)), transparent);
          animation: widget-stream-skeleton-shimmer 1.4s ease-in-out infinite;
        }
        [data-theme="dark"] .widget-stream-skeleton-block::after,
        [data-theme="dark"] .widget-stream-skeleton-chart::after {
          --widget-skeleton-highlight: rgba(255,255,255,0.08);
        }
        @keyframes widget-stream-skeleton-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
}

function latestLoadingMessage(tool: PendingToolCall): string | undefined {
  const messages = tool.argPreview?.loading_messages;
  return messages && messages.length > 0 ? messages[messages.length - 1] : undefined;
}

function buildPreviewHtml(stream: WidgetStreamState): string {
  const style = stream.style.trim()
    ? `<style>${stripWrappingTag(stream.style, 'style')}</style>`
    : '';
  const script = stream.completed && stream.script.trim()
    ? `<script>${stripWrappingTag(stream.script, 'script')}</script>`
    : '';
  return `${style}${stream.markup}${script}`;
}

function stripWrappingTag(text: string, tag: 'style' | 'script'): string {
  return text
    .replace(new RegExp(`^\\s*<${tag}[^>]*>`, 'i'), '')
    .replace(new RegExp(`</${tag}>\\s*$`, 'i'), '');
}
