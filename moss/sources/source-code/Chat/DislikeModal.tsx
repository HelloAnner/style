import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { FeedbackPopoverAnchorRect } from './useMessageFeedbackState';

interface DislikeModalProps {
  isOpen: boolean;
  anchorRect?: FeedbackPopoverAnchorRect | null;
  onClose: () => void;
  onSubmit: (reasons: string[], comment: string) => void | Promise<void>;
}

type ReasonKey = '数据不准' | '反应过慢' | '分析不深' | '废话冗长' | '答非所问';
type PopoverPosition = { top: number; left: number; width: number };

const REASONS: { key: ReasonKey; label: string }[] = [
  { key: '数据不准', label: '数据不准' },
  { key: '反应过慢', label: '反应过慢' },
  { key: '分析不深', label: '分析不深' },
  { key: '废话冗长', label: '废话冗长' },
  { key: '答非所问', label: '答非所问' },
];

const POPOVER_WIDTH = 300;
const POPOVER_GAP = 8;
const POPOVER_VIEWPORT_PADDING = 8;
const POPOVER_ESTIMATED_HEIGHT = 218;

const DislikeModal = memo(function DislikeModal({
  isOpen,
  anchorRect,
  onClose,
  onSubmit,
}: DislikeModalProps) {
  const [checkedReasons, setCheckedReasons] = useState<ReasonKey[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    const updatePosition = () => {
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - POPOVER_VIEWPORT_PADDING * 2);
      const anchor = anchorRect ?? {
        top: POPOVER_VIEWPORT_PADDING,
        left: POPOVER_VIEWPORT_PADDING,
        bottom: POPOVER_VIEWPORT_PADDING,
        width: 0,
        height: 0,
      };
      const maxLeft = window.innerWidth - width - POPOVER_VIEWPORT_PADDING;
      const left = Math.max(POPOVER_VIEWPORT_PADDING, Math.min(anchor.left, maxLeft));
      const height = popoverRef.current?.offsetHeight || POPOVER_ESTIMATED_HEIGHT;
      const topBelow = anchor.bottom + POPOVER_GAP;
      const top = topBelow + height > window.innerHeight - POPOVER_VIEWPORT_PADDING
        ? Math.max(POPOVER_VIEWPORT_PADDING, anchor.top - height - POPOVER_GAP)
        : topBelow;
      setPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRect, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setCheckedReasons([]);
    setComment('');
    setSubmitting(false);
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isOpen, onClose]);

  const toggleReason = useCallback((key: ReasonKey) => {
    setCheckedReasons((prev) => prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting || (checkedReasons.length === 0 && !comment.trim())) return;
    setSubmitting(true);
    try {
      await onSubmit(checkedReasons, comment);
    } finally {
      setSubmitting(false);
    }
  }, [checkedReasons, comment, onSubmit, submitting]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: position?.width ?? POPOVER_WIDTH,
        visibility: position ? 'visible' : 'hidden',
        zIndex: 1300,
        padding: 12,
        borderRadius: 8,
        background: 'var(--bg-elevated)',
        border: 'none',
        boxShadow: 'var(--chat-popover-shadow)',
      }}
      data-testid="dislike-modal"
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginBottom: 12 }} data-testid="dislike-modal-reasons">
        {REASONS.map(({ key, label }, index) => {
          const isChecked = checkedReasons.includes(key);
          return (
            <button
              type="button"
              key={key}
              onClick={() => toggleReason(key)}
              style={{
                minWidth: 80,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: '22px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                textAlign: 'left',
              }}
              className="dislike-modal-reason"
              data-testid={`dislike-modal-reason-${index}`}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 2,
                  border: `1px solid ${isChecked ? 'var(--chat-checkbox-checked-bg)' : 'var(--chat-checkbox-border)'}`,
                  background: isChecked ? 'var(--chat-checkbox-checked-bg)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isChecked && <Check size={10} color="var(--chat-button-primary-text)" strokeWidth={3} />}
              </span>
              {label}
            </button>
          );
        })}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="其他我想吐槽的"
        maxLength={500}
        rows={3}
        style={{
          width: '100%',
          height: 72,
          padding: '7px 8px',
          borderRadius: 6,
          border: '1px solid var(--border-default)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: 14,
          lineHeight: '22px',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
        data-testid="dislike-modal-comment"
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        <button
          onClick={onClose}
          disabled={submitting}
          style={{
            padding: '4px 12px',
            minWidth: 56,
            height: 32,
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: 14,
            lineHeight: '22px',
            opacity: submitting ? 0.5 : 1,
          }}
          data-testid="dislike-modal-cancel"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || (checkedReasons.length === 0 && !comment.trim())}
          style={{
            padding: '4px 12px',
            minWidth: 56,
            height: 32,
            borderRadius: 6,
            background: (checkedReasons.length === 0 && !comment.trim()) ? 'var(--border-default)' : 'var(--chat-button-primary-bg)',
            color: 'var(--chat-button-primary-text)',
            border: 'none',
            cursor: submitting || (checkedReasons.length === 0 && !comment.trim()) ? 'not-allowed' : 'pointer',
            fontSize: 14,
            lineHeight: '22px',
            opacity: submitting ? 0.7 : 1,
          }}
          data-testid="dislike-modal-submit"
        >
          确定
        </button>
      </div>
    </div>,
    document.body,
  );
});

export default DislikeModal;
