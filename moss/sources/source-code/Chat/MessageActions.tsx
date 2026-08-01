import React, { memo, useState, useCallback, useEffect } from 'react';
import { Check, RefreshCcw, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import type { ThumbsState } from '../../types';
import MessageFeedback from './MessageFeedback';
import type { FeedbackChoice } from '../../api/feedback';

interface MessageActionsProps {
  content: string;
  canRetry: boolean;
  retryDisabled?: boolean;
  retryDisabledTitle?: string;
  onRetry?: () => void;
  feedbackCardVisible?: boolean;
  feedbackSessionId?: string;
  feedbackMessageId?: string;
  feedbackRunId?: string;
  feedbackDone?: boolean;
  thumbsState?: ThumbsState;
  onThumbsUp?: () => void;
  onThumbsDown?: (anchorRect?: DOMRect | null) => void;
  onFeedbackSubmitted?: (choice: FeedbackChoice) => void;
  testId?: string;
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Continue to the selection-based fallback; browser clipboard permission can be denied transiently.
    }
  }
  if (typeof document === 'undefined') {
    throw new Error('clipboard unavailable');
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('copy failed');
}

type CopyState = 'idle' | 'success' | 'error';

const btnBase: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  border: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s, color 0.15s',
};

const ICON_SIZE = 14;

function CopyIcon({ size = ICON_SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 212 212" fill="none" aria-hidden="true">
      <path
        d="M180.826 0.0107422C198.117 0.448953 212 14.6031 212 32V140L211.989 140.826C211.551 158.117 197.397 172 180 172H172V180L171.989 180.826C171.551 198.117 157.397 212 140 212H32C14.3269 212 0 197.673 0 180V72C2.66376e-06 54.6031 13.8825 40.449 31.1738 40.0107L32 40H40V32C40 14.6031 53.8825 0.44895 71.1738 0.0107422L72 0H180L180.826 0.0107422ZM32 58C24.268 58 18 64.268 18 72V180C18 187.732 24.268 194 32 194H140C147.732 194 154 187.732 154 180V72C154 64.268 147.732 58 140 58H32ZM140.826 40.0107C158.117 40.449 172 54.6031 172 72V154H180C187.732 154 194 147.732 194 140V32C194 24.268 187.732 18 180 18H72C64.268 18 58 24.268 58 32V40H140L140.826 40.0107Z"
        fill="currentColor"
        fillOpacity="0.85"
      />
    </svg>
  );
}

function RefreshIcon({ size = 16 }: { size?: number }) {
  // The old filled asset breaks up at action-bar size; this keeps the retry glyph crisp.
  return <RefreshCcw size={size} strokeWidth={2} aria-hidden="true" />;
}

function SolidThumbIcon({
  direction,
  size = ICON_SIZE,
}: {
  direction: 'up' | 'down';
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 198.956 209" fill="none" aria-hidden="true">
      <g transform={direction === 'down' ? 'translate(0 209) scale(1 -1)' : undefined}>
        <path
          d="M108.083 0C123.501 0 136 12.4989 136 27.917V69C136 71.2091 137.791 73 140 73H166.95L167.862 73.0127C186.94 73.5426 201.406 90.6394 198.609 109.656L188.021 181.656L187.905 182.389C185.29 197.722 171.988 209 156.361 209H32C14.6031 209 0.448951 195.117 0.0107422 177.826L0 177V121C0 103.327 14.3269 89 32 89H45.3818C47.724 89 49.8522 87.637 50.8318 85.5094L82.7539 16.1787C87.3258 6.31332 97.2097 2.36256e-05 108.083 0ZM32 107C24.268 107 18 113.268 18 121V177C18 184.732 24.268 191 32 191H44C46.2091 191 48 189.209 48 187V111C48 108.791 46.2091 107 44 107H32Z"
          fill="currentColor"
          fillOpacity="0.85"
        />
      </g>
    </svg>
  );
}

function CopyStatusTip({ state }: { state: Exclude<CopyState, 'idle'> }) {
  const isSuccess = state === 'success';
  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      style={{
        position: 'fixed',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 40,
        padding: '9px 13px',
        borderRadius: 6,
        background: 'var(--bg-elevated)',
        border: 'none',
        boxShadow: 'var(--chat-toast-shadow)',
        color: 'var(--text-primary)',
        fontSize: 14,
        lineHeight: '22px',
        fontWeight: 400,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isSuccess ? 'var(--success)' : 'var(--danger)',
          color: 'var(--btn-primary-text)',
          flexShrink: 0,
        }}
      >
        {isSuccess ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
      </span>
      {isSuccess ? '复制成功' : '复制失败'}
    </div>
  );
}

const MessageActions = memo(function MessageActions({
  content,
  canRetry,
  retryDisabled = false,
  retryDisabledTitle = '当前不可重试',
  onRetry,
  feedbackCardVisible = false,
  feedbackSessionId,
  feedbackMessageId,
  feedbackRunId,
  feedbackDone = false,
  thumbsState = 'none',
  onThumbsUp,
  onThumbsDown,
  onFeedbackSubmitted,
  testId,
}: MessageActionsProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 1400);
    return () => clearTimeout(timer);
  }, [copyState]);

  const handleCopy = useCallback(async () => {
    try {
      await copyText(content);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }, [content]);

  const mkHover = (id: string) => ({
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
  });

  const bgFor = (id: string) =>
    hovered === id ? 'var(--hover-bg)' : 'transparent';

  return (
    <div
      style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, padding: '6px 0', flexWrap: 'wrap' }}
      data-testid={testId ?? 'message-actions'}
    >
      {copyState !== 'idle' && <CopyStatusTip state={copyState} />}

      {/* 复制 */}
      <button
        style={{ ...btnBase, background: bgFor('copy') }}
        onClick={handleCopy}
        title="复制"
        {...mkHover('copy')}
        data-testid="message-action-copy"
      >
        <CopyIcon />
      </button>

      {/* 重试 */}
      {canRetry && (
        <button
          style={{
            ...btnBase,
            background: retryDisabled ? 'transparent' : bgFor('retry'),
            color: retryDisabled ? 'var(--text-tertiary)' : 'var(--text-muted)',
            cursor: retryDisabled ? 'not-allowed' : 'pointer',
            opacity: retryDisabled ? 0.45 : 1,
          }}
          onClick={retryDisabled ? undefined : onRetry}
          disabled={retryDisabled}
          title={retryDisabled ? retryDisabledTitle : '重新生成'}
          {...(!retryDisabled ? mkHover('retry') : {})}
          data-testid="message-action-retry"
        >
          <RefreshIcon />
        </button>
      )}

      {/* 反馈卡片 / 已提交文案 / 点赞点踩（互斥） */}
      {feedbackDone ? (
        <span style={{ fontSize: 12, lineHeight: '20px', color: 'var(--text-muted)', padding: '4px 0' }}>
          谢谢你的反馈，我们会继续优化进步
        </span>
      ) : feedbackCardVisible && feedbackSessionId && feedbackMessageId ? (
        <MessageFeedback
          sessionId={feedbackSessionId}
          messageId={feedbackMessageId}
          runId={feedbackRunId}
          onSubmitted={onFeedbackSubmitted}
        />
      ) : (
        <>
          {onThumbsUp && thumbsState !== 'disliked' && (
            <button
              style={{
                ...btnBase,
                background: bgFor('thumbsUp'),
                color: thumbsState === 'liked' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
              onClick={onThumbsUp}
              title={thumbsState === 'liked' ? '取消点赞' : '点赞'}
              {...mkHover('thumbsUp')}
              data-testid="message-action-thumbs-up"
            >
              {thumbsState === 'liked' ? <SolidThumbIcon direction="up" /> : <ThumbsUp size={ICON_SIZE} />}
            </button>
          )}
          {onThumbsDown && thumbsState !== 'liked' && (
            <button
              style={{
                ...btnBase,
                background: bgFor('thumbsDown'),
                color: thumbsState === 'disliked' ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
              onClick={(event) => onThumbsDown(event.currentTarget.getBoundingClientRect())}
              title={thumbsState === 'disliked' ? '取消点踩' : '点踩'}
              {...mkHover('thumbsDown')}
              data-testid="message-action-thumbs-down"
            >
              {thumbsState === 'disliked' ? <SolidThumbIcon direction="down" /> : <ThumbsDown size={ICON_SIZE} />}
            </button>
          )}
        </>
      )}
    </div>
  );
});

export default MessageActions;
