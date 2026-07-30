import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { WufanExecutionNotice as WufanExecutionNoticeData } from './types';

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '刚刚';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return '刚刚';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusIcon({
  success,
}: {
  success: boolean;
}): React.ReactElement {
  return success ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 12 5 5L20 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r=".7" fill="currentColor" />
    </svg>
  );
}

const NoticeItem = memo(function NoticeItem({
  notice,
  autoDismissMs,
  onClick,
  onDismiss,
}: {
  notice: WufanExecutionNoticeData;
  autoDismissMs: number;
  onClick?: (notice: WufanExecutionNoticeData) => void;
  onDismiss: (id: string) => void;
}): React.ReactElement {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearDismiss();
    setLeaving(true);
    window.setTimeout(() => onDismiss(notice.id), 300);
  }, [clearDismiss, notice.id, onDismiss]);

  const scheduleDismiss = useCallback(() => {
    clearDismiss();
    if (autoDismissMs <= 0) return;
    timerRef.current = setTimeout(dismiss, autoDismissMs);
  }, [autoDismissMs, clearDismiss, dismiss]);

  useEffect(() => {
    scheduleDismiss();
    return clearDismiss;
  }, [clearDismiss, scheduleDismiss]);

  const statusText =
    notice.status === 'success'
      ? '执行完成'
      : notice.status === 'failed'
        ? '执行异常'
        : '执行状态更新';

  return (
    <button
      type="button"
      className="wufan-execution-notice"
      data-leaving={leaving ? 'true' : 'false'}
      onMouseEnter={clearDismiss}
      onMouseLeave={() => {
        if (!leaving) scheduleDismiss();
      }}
      onClick={() => {
        onClick?.(notice);
        dismiss();
      }}
    >
      <strong title={notice.title}>{notice.title}</strong>
      {notice.summary ? <p>{notice.summary}</p> : null}
      <span className="wufan-execution-notice__footer">
        <span className="wufan-execution-notice__status">
          <StatusIcon success={notice.status === 'success'} />
          <span>{statusText}</span>
          <time>{timeAgo(notice.createdAt)}</time>
        </span>
        <span>查看详情</span>
      </span>
    </button>
  );
});

export const WufanExecutionNotices = memo(function WufanExecutionNotices({
  notices,
  autoDismissMs = 5000,
  onNoticeClick,
}: {
  notices: WufanExecutionNoticeData[];
  autoDismissMs?: number;
  onNoticeClick?: (notice: WufanExecutionNoticeData) => void;
}): React.ReactElement | null {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const visible = notices.filter((notice) => !dismissed.has(notice.id));

  useEffect(() => {
    const ids = new Set(notices.map((notice) => notice.id));
    setDismissed((current) => {
      const next = new Set(Array.from(current).filter((id) => ids.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [notices]);

  if (!visible.length) return null;

  return (
    <div className="wufan-execution-notice-region" aria-live="polite" aria-label="执行状态通知">
      {visible.map((notice) => (
        <NoticeItem
          key={notice.id}
          notice={notice}
          autoDismissMs={autoDismissMs}
          onClick={onNoticeClick}
          onDismiss={(id) =>
            setDismissed((current) => {
              const next = new Set(current);
              next.add(id);
              return next;
            })
          }
        />
      ))}
    </div>
  );
});
