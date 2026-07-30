import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type {
  WufanFeedbackReason,
  WufanFeedbackSubmission,
  WufanMessageFeedback,
  WufanTheme,
  WufanThumbsState,
} from './types';

const REASONS: WufanFeedbackReason[] = [
  '数据不准',
  '反应过慢',
  '分析不深',
  '废话冗长',
  '答非所问',
];

const POPOVER_WIDTH = 300;
const POPOVER_GAP = 8;
const POPOVER_VIEWPORT_PADDING = 8;
const POPOVER_ESTIMATED_HEIGHT = 218;

type AnchorRect = {
  top: number;
  left: number;
  bottom: number;
  width: number;
  height: number;
};

function storageKey(sessionId: string, messageId: string): string {
  return `wufan:feedback:v1:${sessionId}:${messageId}`;
}

function storedChoiceToState(choice: string | null): WufanThumbsState {
  if (choice === 'thumbs_up') return 'liked';
  if (choice === 'thumbs_down') return 'disliked';
  return 'none';
}

function OutlineThumb({
  direction,
}: {
  direction: 'up' | 'down';
}): React.ReactElement {
  return direction === 'up' ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 10v11H3V10h4Zm0 9h10a3 3 0 0 0 3-3v-5a3 3 0 0 0-3-3h-2l1-5a2 2 0 0 0-2-2L9 8H7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 14V3h4v11h-4Zm0-9H7a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h2l-1 5a2 2 0 0 0 2 2l5-7h2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SolidThumb({
  direction,
}: {
  direction: 'up' | 'down';
}): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 198.956 209" fill="none" aria-hidden="true">
      <g transform={direction === 'down' ? 'translate(0 209) scale(1 -1)' : undefined}>
        <path
          d="M108.083 0C123.501 0 136 12.4989 136 27.917V69C136 71.2091 137.791 73 140 73H166.95L167.862 73.0127C186.94 73.5426 201.406 90.6394 198.609 109.656L188.021 181.656L187.905 182.389C185.29 197.722 171.988 209 156.361 209H32C14.6031 209 .448951 195.117.0107422 177.826L0 177V121C0 103.327 14.3269 89 32 89H45.3818C47.724 89 49.8522 87.637 50.8318 85.5094L82.7539 16.1787C87.3258 6.31332 97.2097 0 108.083 0ZM32 107C24.268 107 18 113.268 18 121V177C18 184.732 24.268 191 32 191H44C46.2091 191 48 189.209 48 187V111C48 108.791 46.2091 107 44 107H32Z"
          fill="currentColor"
          fillOpacity=".85"
        />
      </g>
    </svg>
  );
}

function CopyIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="8" y="8" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 8V6a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

const DislikePopover = memo(function DislikePopover({
  open,
  anchor,
  theme,
  onClose,
  onSubmit,
}: {
  open: boolean;
  anchor: AnchorRect | null;
  theme: WufanTheme;
  onClose: () => void;
  onSubmit: (
    reasons: WufanFeedbackReason[],
    comment: string,
  ) => void | Promise<void>;
}): React.ReactElement | null {
  const [checked, setChecked] = useState<WufanFeedbackReason[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const updatePosition = () => {
      const width = Math.min(
        POPOVER_WIDTH,
        window.innerWidth - POPOVER_VIEWPORT_PADDING * 2,
      );
      const target = anchor ?? {
        top: POPOVER_VIEWPORT_PADDING,
        left: POPOVER_VIEWPORT_PADDING,
        bottom: POPOVER_VIEWPORT_PADDING,
        width: 0,
        height: 0,
      };
      const maxLeft = window.innerWidth - width - POPOVER_VIEWPORT_PADDING;
      const left = Math.max(
        POPOVER_VIEWPORT_PADDING,
        Math.min(target.left, maxLeft),
      );
      const height =
        popoverRef.current?.offsetHeight ?? POPOVER_ESTIMATED_HEIGHT;
      const below = target.bottom + POPOVER_GAP;
      const top =
        below + height > window.innerHeight - POPOVER_VIEWPORT_PADDING
          ? Math.max(
              POPOVER_VIEWPORT_PADDING,
              target.top - height - POPOVER_GAP,
            )
          : below;
      setPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchor, open]);

  useEffect(() => {
    if (!open) return;
    setChecked([]);
    setComment('');
    setSubmitting(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const handleMouseDown = (event: MouseEvent) => {
      if (
        popoverRef.current
        && !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [onClose, open]);

  const canSubmit = checked.length > 0 || Boolean(comment.trim());

  const submit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(checked, comment);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, checked, comment, onSubmit, submitting]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="wufan-feedback-popover"
      data-theme={theme}
      role="dialog"
      aria-label="点踩原因"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: position?.width ?? POPOVER_WIDTH,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="wufan-feedback-popover__reasons">
        {REASONS.map((reason) => {
          const selected = checked.includes(reason);
          return (
            <button
              type="button"
              className="wufan-feedback-reason"
              aria-pressed={selected}
              key={reason}
              onClick={() =>
                setChecked((current) =>
                  current.includes(reason)
                    ? current.filter((item) => item !== reason)
                    : [...current, reason],
                )
              }
            >
              <span className="wufan-feedback-checkbox" data-checked={selected ? 'true' : 'false'}>
                {selected ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="m2 5 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              {reason}
            </button>
          );
        })}
      </div>
      <textarea
        value={comment}
        placeholder="其他我想吐槽的"
        maxLength={500}
        rows={3}
        aria-label="其他反馈"
        onChange={(event) => setComment(event.target.value)}
      />
      <div className="wufan-feedback-popover__actions">
        <button type="button" className="is-cancel" disabled={submitting} onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="is-submit"
          disabled={!canSubmit || submitting}
          onClick={submit}
        >
          确定
        </button>
      </div>
    </div>,
    document.body,
  );
});

export const WufanMessageActions = memo(function WufanMessageActions({
  messageId,
  content,
  feedback,
  theme,
  onSubmitFeedback,
  onRevokeFeedback,
}: {
  messageId: string;
  content: string;
  feedback?: WufanMessageFeedback;
  theme: WufanTheme;
  onSubmitFeedback?: (
    submission: WufanFeedbackSubmission,
  ) => void | Promise<void>;
  onRevokeFeedback?: (
    sessionId: string,
    messageId: string,
  ) => void | Promise<void>;
}): React.ReactElement {
  const key = storageKey(feedback?.sessionId ?? '', messageId);
  const [thumbsState, setThumbsState] = useState<WufanThumbsState>(() => {
    if (typeof localStorage === 'undefined') {
      return feedback?.initialState ?? 'none';
    }
    const stored = storedChoiceToState(localStorage.getItem(key));
    return stored === 'none' ? feedback?.initialState ?? 'none' : stored;
  });
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (typeof localStorage === 'undefined') {
      setThumbsState(feedback?.initialState ?? 'none');
      return;
    }
    const stored = storedChoiceToState(localStorage.getItem(key));
    setThumbsState(stored === 'none' ? feedback?.initialState ?? 'none' : stored);
  }, [feedback?.initialState, key]);

  const persist = useCallback(
    (state: WufanThumbsState) => {
      setThumbsState(state);
      if (typeof localStorage === 'undefined') return;
      if (state === 'none') localStorage.removeItem(key);
      else {
        localStorage.setItem(
          key,
          state === 'liked' ? 'thumbs_up' : 'thumbs_down',
        );
      }
    },
    [key],
  );

  const revoke = useCallback(async () => {
    const previous = thumbsState;
    persist('none');
    if (!feedback) return;
    try {
      await onRevokeFeedback?.(feedback.sessionId, messageId);
    } catch {
      persist(previous);
    }
  }, [feedback, messageId, onRevokeFeedback, persist, thumbsState]);

  const submitLike = useCallback(async () => {
    if (thumbsState === 'liked') {
      await revoke();
      return;
    }
    const previous = thumbsState;
    persist('liked');
    if (!feedback) return;
    try {
      await onSubmitFeedback?.({
        sessionId: feedback.sessionId,
        messageId,
        choice: 'thumbs_up',
        runId: feedback.runId,
      });
    } catch {
      persist(previous);
    }
  }, [feedback, messageId, onSubmitFeedback, persist, revoke, thumbsState]);

  const openDislike = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (thumbsState === 'disliked') {
        void revoke();
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      setAnchor({
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });
      setPopoverOpen(true);
    },
    [revoke, thumbsState],
  );

  const submitDislike = useCallback(
    async (reasons: WufanFeedbackReason[], comment: string) => {
      const previous = thumbsState;
      persist('disliked');
      setPopoverOpen(false);
      setAnchor(null);
      if (!feedback) return;
      try {
        await onSubmitFeedback?.({
          sessionId: feedback.sessionId,
          messageId,
          choice: 'thumbs_down',
          reasons,
          comment: comment.trim() || undefined,
          runId: feedback.runId,
        });
      } catch {
        persist(previous);
      }
    },
    [feedback, messageId, onSubmitFeedback, persist, thumbsState],
  );

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(content);
  }, [content]);

  return (
    <>
      <div className="wufan-message-actions" aria-label="消息操作">
        <button type="button" aria-label="复制" title="复制" onClick={copy}>
          <CopyIcon />
        </button>
        {feedback && thumbsState !== 'disliked' ? (
          <button
            type="button"
            aria-label={thumbsState === 'liked' ? '取消点赞' : '点赞'}
            title={thumbsState === 'liked' ? '取消点赞' : '点赞'}
            aria-pressed={thumbsState === 'liked'}
            onClick={() => void submitLike()}
          >
            {thumbsState === 'liked' ? (
              <SolidThumb direction="up" />
            ) : (
              <OutlineThumb direction="up" />
            )}
          </button>
        ) : null}
        {feedback && thumbsState !== 'liked' ? (
          <button
            type="button"
            aria-label={thumbsState === 'disliked' ? '取消点踩' : '点踩'}
            title={thumbsState === 'disliked' ? '取消点踩' : '点踩'}
            aria-pressed={thumbsState === 'disliked'}
            onClick={openDislike}
          >
            {thumbsState === 'disliked' ? (
              <SolidThumb direction="down" />
            ) : (
              <OutlineThumb direction="down" />
            )}
          </button>
        ) : null}
      </div>
      <DislikePopover
        open={popoverOpen}
        anchor={anchor}
        theme={theme}
        onClose={() => {
          setPopoverOpen(false);
          setAnchor(null);
        }}
        onSubmit={submitDislike}
      />
    </>
  );
});
