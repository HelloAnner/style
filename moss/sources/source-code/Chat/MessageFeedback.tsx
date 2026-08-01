import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { submitMessageFeedback, type FeedbackChoice } from '../../api/feedback';

interface MessageFeedbackProps {
  sessionId: string;
  messageId: string;
  runId?: string;
  onSubmitted?: (choice: FeedbackChoice) => void;
}

type ReasonKey = '数据不准' | '反应过慢' | '分析不深' | '废话冗长' | '答非所问';

const REASONS: { key: ReasonKey; label: string }[] = [
  { key: '数据不准', label: '数据不准' },
  { key: '反应过慢', label: '反应过慢' },
  { key: '分析不深', label: '分析不深' },
  { key: '废话冗长', label: '废话冗长' },
  { key: '答非所问', label: '答非所问' },
];

type FeedbackFace = 'smile' | 'neutral' | 'sad';
type PopoverPosition = { top: number; left: number; width: number };

const POPOVER_WIDTH = 300;
const POPOVER_GAP = 8;
const POPOVER_VIEWPORT_PADDING = 8;
const POPOVER_ESTIMATED_HEIGHT = 218;

const BUTTONS: { value: FeedbackChoice; label: string; face: FeedbackFace; selectedBg: string }[] = [
  { value: 'solved', label: '解决了', face: 'smile', selectedBg: 'var(--chat-feedback-face-solved-bg)' },
  { value: 'partial', label: '部分解决', face: 'neutral', selectedBg: 'var(--chat-feedback-face-partial-bg)' },
  { value: 'unsolved', label: '未解决', face: 'sad', selectedBg: 'var(--chat-feedback-face-unsolved-bg)' },
];

function FeedbackFaceIcon({
  face,
  selected,
  selectedBg,
  size = 14,
}: {
  face: FeedbackFace;
  selected: boolean;
  selectedBg: string;
  size?: number;
}) {
  const mouth = face === 'smile'
    ? 'M148.602 114.871C152.742 117.458 154.051 122.976 150.801 126.619C146.967 130.916 142.432 134.562 137.369 137.392C129.723 141.665 121.122 143.938 112.363 143.999C103.604 144.06 94.9722 141.908 87.2675 137.742C82.1657 134.983 77.58 131.401 73.6863 127.158C70.3854 123.561 71.6173 118.025 75.7211 115.38C79.8249 112.735 85.2366 114.032 88.8394 117.327C90.9029 119.214 93.1974 120.849 95.6766 122.19C100.762 124.939 106.459 126.36 112.24 126.319C118.02 126.279 123.697 124.779 128.743 121.959C131.204 120.584 133.475 118.917 135.512 117.001C139.068 113.656 144.461 112.284 148.602 114.871Z'
    : face === 'neutral'
      ? 'M80 121C80 116.029 84.0294 112 89 112H135C139.971 112 144 116.029 144 121C144 125.971 139.971 130 135 130H89C84.0294 130 80 125.971 80 121Z'
      : 'M148.602 144.129C152.742 141.542 154.051 136.024 150.801 132.381C146.967 128.084 142.432 124.438 137.369 121.608C129.723 117.335 121.122 115.062 112.363 115.001C103.604 114.94 94.9722 117.092 87.2675 121.258C82.1657 124.017 77.58 127.599 73.6863 131.842C70.3854 135.439 71.6173 140.975 75.7211 143.62C79.8249 146.265 85.2366 144.968 88.8394 141.673C90.9029 139.786 93.1974 138.151 95.6766 136.81C100.762 134.061 106.459 132.64 112.24 132.681C118.02 132.721 123.697 134.221 128.743 137.041C131.204 138.416 133.475 140.083 135.512 141.999C139.068 145.344 144.461 146.716 148.602 144.129Z';
  const ink = selected ? 'var(--chat-feedback-face-ink)' : 'currentColor';
  return (
    <svg width={size} height={size} viewBox="0 0 224 224" fill="none" aria-hidden="true">
      {selected && <circle cx="112" cy="112" r="112" fill={selectedBg} />}
      <path d="M86 83C86 91.8366 78.8366 99 70 99C61.1634 99 54 91.8366 54 83C54 74.1634 61.1634 67 70 67C78.8366 67 86 74.1634 86 83Z" fill={ink} fillOpacity="0.85" />
      <path d="M170 83C170 91.8366 162.837 99 154 99C145.163 99 138 91.8366 138 83C138 74.1634 145.163 67 154 67C162.837 67 170 74.1634 170 83Z" fill={ink} fillOpacity="0.85" />
      <path d={mouth} fill={ink} fillOpacity="0.85" />
      {!selected && (
        <path clipRule="evenodd" d="M224 112C224 173.856 173.856 224 112 224C50.1441 224 0 173.856 0 112C0 50.1441 50.1441 0 112 0C173.856 0 224 50.1441 224 112ZM208 112C208 165.019 165.019 208 112 208C58.9807 208 16 165.019 16 112C16 58.9807 58.9807 16 112 16C165.019 16 208 58.9807 208 112Z" fill="currentColor" fillOpacity="0.85" fillRule="evenodd" />
      )}
    </svg>
  );
}

function getStorageKey(sessionId: string, messageId: string) {
  return `moss:feedback:v1:${sessionId}:${messageId}`;
}

const MessageFeedback = memo(function MessageFeedback({
  sessionId,
  messageId,
  runId,
  onSubmitted,
}: MessageFeedbackProps) {
  const [selected, setSelected] = useState<FeedbackChoice | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverChoice, setPopoverChoice] = useState<'partial' | 'unsolved'>('unsolved');
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<FeedbackChoice | null>(null);
  const [checkedReasons, setCheckedReasons] = useState<ReasonKey[]>([]);
  const [comment, setComment] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const partialBtnRef = useRef<HTMLButtonElement>(null);
  const unsolvedBtnRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!showPopover) {
      setPopoverPosition(null);
      return;
    }
    const updatePosition = () => {
      const btnRef = popoverChoice === 'partial' ? partialBtnRef : unsolvedBtnRef;
      const btnRect = btnRef.current?.getBoundingClientRect();
      if (!btnRect) return;
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - POPOVER_VIEWPORT_PADDING * 2);
      const maxLeft = window.innerWidth - width - POPOVER_VIEWPORT_PADDING;
      const left = Math.max(POPOVER_VIEWPORT_PADDING, Math.min(btnRect.left, maxLeft));
      const height = popoverRef.current?.offsetHeight || POPOVER_ESTIMATED_HEIGHT;
      const bottomTop = btnRect.bottom + POPOVER_GAP;
      const top = bottomTop + height > window.innerHeight - POPOVER_VIEWPORT_PADDING
        ? Math.max(POPOVER_VIEWPORT_PADDING, btnRect.top - height - POPOVER_GAP)
        : bottomTop;
      setPopoverPosition({ top, left, width });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [showPopover, popoverChoice]);

  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(sessionId, messageId));
    if (stored) {
      setSelected(stored as FeedbackChoice);
      setSubmitted(true);
    }
  }, [sessionId, messageId]);

  useEffect(() => {
    if (!showPopover) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setSelected(null);
        setShowPopover(false);
        setCheckedReasons([]);
        setComment('');
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showPopover]);

  const doSubmit = useCallback(
    async (choice: FeedbackChoice, reasons?: string[], commentText?: string) => {
      try {
        await submitMessageFeedback(sessionId, messageId, {
          choice,
          reasons: reasons && reasons.length > 0 ? reasons : undefined,
          comment: commentText || undefined,
          run_id: runId || undefined,
        });
        localStorage.setItem(getStorageKey(sessionId, messageId), choice);
        localStorage.removeItem(`moss:feedback-card:v1:${sessionId}:${messageId}`);
        setSelected(choice);
        setSubmitted(true);
        setShowPopover(false);
        onSubmitted?.(choice);
      } catch {
        alert('提交失败，请稍后再试');
      }
    },
    [sessionId, messageId, runId, onSubmitted],
  );

  const handleBtnClick = useCallback(
    (choice: FeedbackChoice) => {
      if (submitted) return;
      if (choice === 'partial' || choice === 'unsolved') {
        setSelected(choice);
        setPopoverChoice(choice);
        setShowPopover(true);
      } else {
        setSelected(choice);
        doSubmit(choice);
      }
    },
    [submitted, doSubmit],
  );

  const toggleReason = useCallback((key: ReasonKey) => {
    setCheckedReasons((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key],
    );
  }, []);

  const handlePopoverSubmit = useCallback(() => {
    doSubmit(popoverChoice, checkedReasons, comment);
  }, [doSubmit, popoverChoice, checkedReasons, comment]);

  const handlePopoverCancel = useCallback(() => {
    setSelected(null);
    setShowPopover(false);
    setCheckedReasons([]);
    setComment('');
  }, []);

  if (submitted) {
    return (
      <span
        style={{ fontSize: 12, lineHeight: '20px', color: 'var(--text-muted)', padding: '4px 0' }}
        data-testid="message-feedback-submitted"
      >
        谢谢你的反馈，我们会继续优化进步
      </span>
    );
  }

  return (
    <span
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 24,
        padding: 0,
      }}
      data-testid="message-feedback"
    >
      <span style={{ fontSize: 12, lineHeight: '20px', color: 'var(--text-muted)' }}>
        是否有解决你的问题？
      </span>
      {BUTTONS.map(({ value, label, face, selectedBg }) => {
        const isSelected = selected === value;
        const isHovered = hoveredBtn === value;
        return (
          <button
            key={value}
            ref={value === 'partial' ? partialBtnRef : value === 'unsolved' ? unsolvedBtnRef : undefined}
            onClick={() => handleBtnClick(value)}
            onMouseEnter={() => setHoveredBtn(value)}
            onMouseLeave={() => setHoveredBtn(null)}
            className="message-feedback-option"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '0 4px',
              minHeight: 24,
              borderRadius: 4,
              border: 'none',
              background: isHovered ? 'var(--hover-bg)' : 'transparent',
              color: isSelected
                ? 'var(--chat-feedback-option-selected-text)'
                : 'var(--chat-feedback-option-muted)',
              fontSize: 12,
              lineHeight: '20px',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            data-testid={`message-feedback-${value}`}
          >
            <FeedbackFaceIcon face={face} selected={isSelected} selectedBg={selectedBg} />
            {label}
          </button>
        );
      })}

      {showPopover && typeof document !== 'undefined' && createPortal((
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: popoverPosition?.top ?? 0,
            left: popoverPosition?.left ?? 0,
            width: popoverPosition?.width ?? POPOVER_WIDTH,
            visibility: popoverPosition ? 'visible' : 'hidden',
            zIndex: 1300,
            padding: 12,
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            border: 'none',
            boxShadow: 'var(--chat-popover-shadow)',
          }}
          data-testid="message-feedback-popover"
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 16px',
              marginBottom: 12,
            }}
          >
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
                  className="message-feedback-reason"
                  data-testid={`message-feedback-reason-${index}`}
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
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 12,
            }}
          >
            <button
              onClick={handlePopoverCancel}
              style={{
                padding: '4px 12px',
                minWidth: 56,
                height: 32,
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: '22px',
              }}
              data-testid="message-feedback-cancel"
            >
              取消
            </button>
            <button
              onClick={handlePopoverSubmit}
              disabled={checkedReasons.length === 0 && !comment.trim()}
              style={{
                padding: '4px 12px',
                minWidth: 56,
                height: 32,
                borderRadius: 6,
                background: (checkedReasons.length === 0 && !comment.trim()) ? 'var(--border-default)' : 'var(--chat-button-primary-bg)',
                color: 'var(--chat-button-primary-text)',
                border: 'none',
                cursor: (checkedReasons.length === 0 && !comment.trim()) ? 'not-allowed' : 'pointer',
                fontSize: 14,
                lineHeight: '22px',
              }}
              data-testid="message-feedback-submit"
            >
              确定
            </button>
          </div>
        </div>
      ), document.body)}
    </span>
  );
});

export default MessageFeedback;
