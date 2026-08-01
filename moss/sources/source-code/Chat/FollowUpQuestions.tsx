import { memo, useMemo } from 'react';
import type { FollowUpQuestionItem, FollowUpQuestionsData } from '../../types';

interface FollowUpQuestionsProps {
  data: FollowUpQuestionsData;
  disabled?: boolean;
  onSelect?: (item: FollowUpQuestionItem) => void;
  testId?: string;
}

function FigmaFollowUpIcon({ className }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 9.33685 8.62501"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M0.421875 0C0.65487 0 0.84375 0.18888 0.84375 0.421875V2.01562C0.84375 3.25827 1.85111 4.26562 3.09375 4.26562H8.07523L5.23293 1.42332C5.06817 1.25857 5.06817 0.991428 5.23293 0.826675C5.39768 0.661923 5.66482 0.661923 5.82957 0.826675L9.10345 4.1006C9.41465 4.4118 9.41465 4.91633 9.10345 5.22752L5.82957 8.50145C5.66482 8.6662 5.39768 8.6662 5.23293 8.50145C5.06817 8.3367 5.06817 8.06955 5.23293 7.9048L8.02835 5.10938H3.09375C1.38512 5.10938 0 3.72426 0 2.01562V0.421875C0 0.18888 0.18888 0 0.421875 0Z"
        fill="currentColor"
        fillOpacity="0.7"
      />
    </svg>
  );
}

export const FollowUpQuestions = memo(function FollowUpQuestions({
  data,
  disabled = false,
  onSelect,
  testId,
}: FollowUpQuestionsProps) {
  const items = useMemo(() => data.items.filter((item) => item.text.trim()), [data.items]);
  if (items.length === 0) return null;
  const isDisabled = disabled || data.used === true;

  return (
    <div
      className="follow-up-questions"
      style={{
        marginTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: '100%',
      }}
      data-testid={testId ?? 'follow-up-questions'}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={isDisabled}
          onClick={() => onSelect?.(item)}
          title={isDisabled ? undefined : item.text}
          className="follow-up-question-button"
          data-testid={`follow-up-question-${item.id}`}
        >
          <FigmaFollowUpIcon className="follow-up-question-icon" />
          <span className="follow-up-question-text">{item.text}</span>
        </button>
      ))}
      <style>{`
        .follow-up-question-button {
          width: fit-content;
          max-width: 100%;
          min-height: 28px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 8px;
          border: 0;
          background: rgba(11, 11, 11, 0.05);
          color: rgba(11, 11, 11, 0.7);
          cursor: pointer;
          transition: background 0.15s, color 0.15s, opacity 0.15s, transform 0.15s;
        }
        .follow-up-question-button:not(:disabled):hover {
          background: rgba(11, 11, 11, 0.07);
          color: rgba(11, 11, 11, 0.7);
        }
        .follow-up-question-button:not(:disabled):active {
          background: rgba(11, 11, 11, 0.09);
          transform: translateY(1px);
        }
        .follow-up-question-button:disabled {
          cursor: default;
          opacity: 0.55;
        }
        .follow-up-question-icon {
          flex: 0 0 auto;
          width: 10px;
          height: 10px;
          color: currentColor;
        }
        .follow-up-question-text {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          white-space: normal;
          text-align: left;
          font-size: 12px;
          line-height: 18px;
        }
      `}</style>
    </div>
  );
});
