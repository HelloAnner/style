/**
 * WidgetPendingCard — show_widget / graph_3d 工具参数生成期间的占位卡
 *
 * 视觉与 WidgetRenderer 的 header 1:1 对齐（边框/字号/padding 完全一致），
 * 等参数生成完成、widget 真正渲染时只是 shimmer 区域被替换，header 保持视觉连续。
 *
 * Header：
 *   左：argPreview.title（拿到后即显示），未拿到时显示「绘制中」/「构建中」
 *   右：从挂载起 3 秒后开始显示 elapsed seconds，避免快速场景下闪现
 *
 * Body：shimmer 光带 + 居中文案
 *   - 有 loading_messages：显示最新一条
 *   - 无 loading_messages：兜底为「正在绘制 "{title}"…」/「正在构建 "{title}"…」
 *     （title 也未拿到时退化为「正在绘制…」/「正在构建…」）
 */

import React, { memo, useEffect, useState } from 'react';
import { useFrontendConfigStore } from '../../stores/frontendConfigStore';

interface WidgetPendingCardProps {
  toolName: 'show_widget' | 'graph_3d';
  /** 工具调用挂载时刻（ISO 字符串，对应 WS tool_call_start 事件时间）。用作计时器起点。 */
  startedAt?: string;
  /** Kernel 通过 tool_arg_preview 流式推送的字段 */
  argPreview?: { title?: string; loading_messages?: string[] };
}

const TIMER_GRACE_MS = 3000;

export const WidgetPendingCard: React.FC<WidgetPendingCardProps> = memo(({
  toolName,
  startedAt,
  argPreview,
}) => {
  const isGraph = toolName === 'graph_3d';
  const showToolDurations = useFrontendConfigStore((state) => state.showToolDurations);
  const title = argPreview?.title;
  const loadingMessages = argPreview?.loading_messages;

  const headerText = title || (isGraph ? '构建中' : '绘制中');

  const latestMessage = loadingMessages && loadingMessages.length > 0
    ? loadingMessages[loadingMessages.length - 1]
    : undefined;

  const fallbackBody = title
    ? (isGraph ? `正在构建 "${title}"…` : `正在绘制 "${title}"…`)
    : (isGraph ? '正在构建…' : '正在绘制…');

  const bodyText = latestMessage || fallbackBody;

  const [elapsedSec, setElapsedSec] = useState<number | null>(null);
  useEffect(() => {
    const startMs = startedAt ? new Date(startedAt).getTime() : Date.now();
    const tick = () => {
      const elapsed = Date.now() - startMs;
      if (elapsed >= TIMER_GRACE_MS) {
        setElapsedSec(Math.floor(elapsed / 1000));
      } else {
        setElapsedSec(null);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div
      className="my-3 rounded-lg overflow-hidden"
      style={{
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        position: 'relative',
      }}
      data-testid="widget-pending-card"
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
        data-testid="widget-pending-card-header"
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: 1,
          }}
        >
          {headerText}
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
            data-testid="widget-pending-card-timer"
          >
            {elapsedSec}s
          </span>
        )}
      </div>

      <div style={{ position: 'relative', minHeight: 130 }} data-testid="widget-pending-card-body">
        <div className="widget-pending-shimmer" data-testid="widget-pending-card-shimmer" />
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontSize: 13,
            color: 'var(--text-muted)',
            textAlign: 'center',
            zIndex: 2,
          }}
          data-testid="widget-pending-card-status"
        >
          <span
            key={bodyText}
            style={{ animation: 'widget-pending-fade 0.25s ease-out' }}
          >
            {bodyText}
          </span>
        </div>
      </div>

      <style>{`
        .widget-pending-shimmer {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(135deg, transparent 0%, transparent 30%, var(--widget-shimmer-highlight, rgba(255,255,255,0.12)) 50%, transparent 70%, transparent 100%);
          background-size: 400% 400%;
          animation: widget-pending-shimmer-anim 2s ease-in-out infinite;
        }
        [data-theme="light"] .widget-pending-shimmer { --widget-shimmer-highlight: rgba(0,0,0,0.06); }
        [data-theme="dark"]  .widget-pending-shimmer { --widget-shimmer-highlight: rgba(255,255,255,0.09); }
        @keyframes widget-pending-shimmer-anim {
          0%   { background-position: 100% 100%; }
          100% { background-position: 0% 0%; }
        }
        @keyframes widget-pending-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
});

WidgetPendingCard.displayName = 'WidgetPendingCard';
